use std::{
    collections::HashMap,
    error::Error,
    fs::read_to_string,
    path::Path,
    process,
};

use jiff::Zoned;
use log::info;
use serde::Deserialize;
use typwriter::{PdfMetadata, typst_version, update_metadata};

/// Document metadata loaded from YAML.
#[derive(Debug, Clone, Deserialize)]
pub struct DocumentMetadata {
    pub title: String,
    pub author: String,
    #[serde(default)]
    pub subject: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub copyright_status: bool,
    #[serde(default)]
    pub application: Option<String>,
    #[serde(default)]
    pub custom_properties: HashMap<String, String>,
}

fn default_language() -> String {
    "en".to_string()
}

pub fn load_metadata(path: &Path) -> Result<DocumentMetadata, Box<dyn Error>> {
    let content = read_to_string(path)?;
    Ok(serde_yml::from_str(&content)?)
}

pub fn apply_metadata(pdf_path: &Path, doc: &DocumentMetadata) -> Result<(), Box<dyn Error>> {
    let application = doc
        .application
        .clone()
        .unwrap_or_else(|| {
            format!("board43-document-compiler v{}", env!("CARGO_PKG_VERSION"))
        });

    let copyright_notice = if doc.copyright_status {
        let year = Zoned::now().strftime("%Y");
        let author = doc.author.trim_end_matches('.');
        format!("\u{00a9} {year} {author}. All rights reserved.")
    } else {
        String::new()
    };

    let mut custom_properties = doc.custom_properties.clone();
    custom_properties.insert("Source hash".to_string(), get_commit_hash(pdf_path));
    custom_properties.insert("Typst version".to_string(), typst_version().to_string());
    custom_properties.insert(
        "Compiler version".to_string(),
        format!("board43-document-compiler v{}", env!("CARGO_PKG_VERSION")),
    );

    let metadata = PdfMetadata {
        title: doc.title.clone(),
        author: doc.author.clone(),
        application,
        subject: doc.subject.clone(),
        copyright_status: doc.copyright_status,
        copyright_notice,
        keywords: doc.keywords.clone(),
        language: doc.language.clone(),
        custom_properties,
    };

    info!("- title: {}", metadata.title);
    info!("- author: {}", metadata.author);
    info!("- subject: {}", metadata.subject);
    info!("- language: {}", metadata.language);
    info!("- keywords: {}", metadata.keywords.join(", "));
    info!("- copyright status: {}", metadata.copyright_status);
    if !metadata.copyright_notice.is_empty() {
        info!("- copyright notice: {}", metadata.copyright_notice);
    }
    info!("- custom properties:");
    metadata
        .custom_properties
        .iter()
        .for_each(|(k, v)| info!("  - {k}: {}", v.trim()));

    update_metadata(pdf_path, &metadata)?;
    info!(r#"Updated metadata for "{}""#, pdf_path.display());
    Ok(())
}

fn get_commit_hash(path: &Path) -> String {
    process::Command::new("git")
        .args(["log", "-n", "1", "--pretty=format:%H", "--", &path.to_string_lossy()])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default()
}
