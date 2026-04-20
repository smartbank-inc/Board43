use std::{error::Error, path::Path};

use log::info;
use lopdf::{
    Dictionary, Document, Object, ObjectId, Stream,
    content::{Content, Operation},
};

pub fn nup(
    input: &Path,
    output: &Path,
    cols: u32,
    rows: u32,
    flip: bool,
) -> Result<(), Box<dyn Error>> {
    let mut doc = Document::load(input)?;
    let page_ids: Vec<ObjectId> = doc.get_pages().into_values().collect();

    if page_ids.is_empty() {
        return Err("No pages in input PDF".into());
    }

    let per_sheet = (cols * rows) as usize;
    let (src_w, src_h) = media_box(&doc, page_ids[0])?;
    let (out_w, out_h) = if flip { (src_h, src_w) } else { (src_w, src_h) };
    info!(
        "Source: {src_w:.0} x {src_h:.0} pt, output: {out_w:.0} x {out_h:.0} pt, {cols}x{rows} layout"
    );

    let cell_w = out_w / cols as f32;
    let cell_h = out_h / rows as f32;
    let scale = (cell_w / src_w).min(cell_h / src_h);
    let rendered_w = src_w * scale;
    let rendered_h = src_h * scale;
    let off_x = (cell_w - rendered_w) / 2.0;
    let off_y = (cell_h - rendered_h) / 2.0;

    // Convert all source pages to Form XObjects
    let xobjects: Vec<ObjectId> = page_ids
        .iter()
        .map(|&pid| to_xobject(&mut doc, pid))
        .collect::<Result<_, _>>()?;

    // Build new n-up pages
    let mut new_page_ids = vec![];

    for chunk in xobjects.chunks(per_sheet) {
        let mut xobj_resources = Dictionary::new();
        let mut ops = vec![];

        for (i, &xobj_id) in chunk.iter().enumerate() {
            let col = (i as u32) % cols;
            let row = (i as u32) / cols;
            let name = format!("P{i}");

            xobj_resources.set(name.as_bytes(), Object::Reference(xobj_id));

            let tx = col as f32 * cell_w + off_x;
            let ty = ((rows - 1 - row) as f32) * cell_h + off_y;

            ops.push(Operation::new("q", vec![]));
            ops.push(Operation::new(
                "cm",
                vec![
                    Object::Real(scale),
                    Object::Integer(0),
                    Object::Integer(0),
                    Object::Real(scale),
                    Object::Real(tx),
                    Object::Real(ty),
                ],
            ));
            ops.push(Operation::new("Do", vec![Object::Name(name.into_bytes())]));
            ops.push(Operation::new("Q", vec![]));
        }

        let content_bytes = Content { operations: ops }.encode()?;
        let mut content_stream = Stream::new(Dictionary::new(), content_bytes);
        content_stream.compress()?;
        let content_id = doc.add_object(content_stream);

        let mut resources = Dictionary::new();
        resources.set("XObject", Object::Dictionary(xobj_resources));

        let mut page_dict = Dictionary::new();
        page_dict.set("Type", Object::Name(b"Page".to_vec()));
        page_dict.set(
            "MediaBox",
            Object::Array(vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Real(out_w),
                Object::Real(out_h),
            ]),
        );
        page_dict.set("Contents", Object::Reference(content_id));
        page_dict.set("Resources", Object::Dictionary(resources));

        let page_id = doc.add_object(Object::Dictionary(page_dict));
        new_page_ids.push(page_id);
    }

    // Update the page tree
    let catalog_id = doc.trailer.get(b"Root")?.as_reference()?;
    let pages_ref = doc.get_object(catalog_id)?.as_dict()?.get(b"Pages")?.as_reference()?;

    for &pid in &new_page_ids {
        if let Ok(Object::Dictionary(d)) = doc.get_object_mut(pid) {
            d.set("Parent", Object::Reference(pages_ref));
        }
    }

    if let Ok(Object::Dictionary(d)) = doc.get_object_mut(pages_ref) {
        d.set(
            "Kids",
            Object::Array(new_page_ids.iter().map(|&id| Object::Reference(id)).collect()),
        );
        d.set("Count", Object::Integer(new_page_ids.len() as i64));
    }

    doc.save(output)?;
    info!("Saved {per_sheet}-up PDF ({} pages) to {}", new_page_ids.len(), output.display());
    Ok(())
}

fn media_box(doc: &Document, page_id: ObjectId) -> Result<(f32, f32), Box<dyn Error>> {
    let page = doc.get_object(page_id)?.as_dict()?;

    let mb = match page.get(b"MediaBox") {
        Ok(obj) => obj.clone(),
        Err(_) => {
            let parent_ref = page.get(b"Parent")?.as_reference()?;
            doc.get_object(parent_ref)?.as_dict()?.get(b"MediaBox")?.clone()
        }
    };

    let arr = match &mb {
        Object::Reference(r) => doc.get_object(*r)?.as_array()?,
        Object::Array(a) => a,
        _ => return Err("Invalid MediaBox".into()),
    };

    let f = |o: &Object| -> f32 {
        match o {
            Object::Integer(n) => *n as f32,
            Object::Real(n) => *n,
            _ => 0.0,
        }
    };

    Ok((f(&arr[2]), f(&arr[3])))
}

fn page_resources(doc: &Document, page_id: ObjectId) -> Result<Object, Box<dyn Error>> {
    let page = doc.get_object(page_id)?.as_dict()?;
    if let Ok(r) = page.get(b"Resources") {
        return Ok(r.clone());
    }
    if let Ok(parent_ref) = page.get(b"Parent").and_then(|o| o.as_reference())
        && let Ok(r) = doc.get_object(parent_ref)?.as_dict()?.get(b"Resources")
    {
        return Ok(r.clone());
    }
    Ok(Object::Dictionary(Dictionary::new()))
}

fn to_xobject(doc: &mut Document, page_id: ObjectId) -> Result<ObjectId, Box<dyn Error>> {
    let (w, h) = media_box(doc, page_id)?;
    let content_data = doc.get_page_content(page_id)?;
    let resources = page_resources(doc, page_id)?;

    let mut dict = Dictionary::new();
    dict.set("Type", Object::Name(b"XObject".to_vec()));
    dict.set("Subtype", Object::Name(b"Form".to_vec()));
    dict.set(
        "BBox",
        Object::Array(vec![
            Object::Integer(0),
            Object::Integer(0),
            Object::Real(w),
            Object::Real(h),
        ]),
    );
    dict.set("Resources", resources);

    let mut stream = Stream::new(dict, content_data);
    stream.compress()?;
    Ok(doc.add_object(stream))
}
