use std::{array::from_fn, sync::LazyLock};

use image::{
    ImageBuffer, ImageError, Rgb,
    imageops::{FilterType, overlay},
    load_from_memory,
};

const SIZE: u32 = 16;
const WS2812_GAMMA: f32 = 2.6;

static GAMMA_LUT: LazyLock<[u8; 256]> =
    LazyLock::new(|| from_fn(|i| ((i as f32 / 255.0).powf(WS2812_GAMMA) * 255.0 + 0.5) as u8));

/// Transforms raw image bytes (PNG/JPEG/etc.) into a 16×16 RGB image.
///
/// Non-square images are letterboxed (black bands) to preserve aspect
/// ratio. Gamma correction (γ = 2.6) is applied for WS2812 LEDs.
pub fn transform(bytes: &[u8]) -> Result<ImageBuffer<Rgb<u8>, Vec<u8>>, ImageError> {
    let scaled = load_from_memory(bytes)?
        .resize(SIZE, SIZE, FilterType::Lanczos3)
        .into_rgb8();
    let (w, h) = scaled.dimensions();
    let mut canvas = ImageBuffer::from_pixel(SIZE, SIZE, Rgb([0u8; 3]));
    overlay(&mut canvas, &scaled, ((SIZE - w) / 2).into(), ((SIZE - h) / 2).into());
    for v in canvas.as_mut() {
        *v = GAMMA_LUT[*v as usize];
    }
    Ok(canvas)
}

#[cfg(target_arch = "wasm32")]
mod wasm {
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub fn transform(image_bytes: &[u8]) -> Result<Vec<u8>, JsError> {
        Ok(super::transform(image_bytes)?.into_raw())
    }
}
