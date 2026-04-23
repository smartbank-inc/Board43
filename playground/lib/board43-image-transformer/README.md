# board43-image-transformer

Transforms images into 16×16 RGB data for Board43. Available as both a CLI tool and a WASM module.

## Supported input formats

PNG, JPEG, GIF, WebP, BMP. To add another format (e.g. `avif`, `tiff`), enable it in the `image` dependency features in `Cargo.toml`.

## Prerequisites

- [Rust](https://rustup.rs/) (edition 2024)
- For WASM: `wasm32-unknown-unknown` target and [wasm-pack](https://rustwasm.github.io/wasm-pack/)

```console
$ rustup target add wasm32-unknown-unknown
$ cargo install wasm-pack
```

## CLI Usage

```console
$ cargo run -- --help
Usage: board43-image-transformer [OPTIONS] <INPUTS>...

Arguments:
  <INPUTS>...  Paths to the images to be processed

Options:
  -o, --output <OUTPUT>  Output directory [default: output]
  -h, --help             Print help
  -V, --version          Print version
```

i.e.

```console
$ cargo run -- input1.png input2.png -o output
```

## WASM Usage

To build WASM:

```console
$ wasm-pack build --target bundler --release
```

Copy these files from `pkg/` into your project:

- `board43_image_transformer.js`: JavaScript glue code
- `board43_image_transformer_bg.wasm`: WASM binary
- `board43_image_transformer.d.ts`: TypeScript types
- `board43_image_transformer_bg.wasm.d.ts`: WASM types

The module exports a single function:

```js
import { transform } from "board43-image-transformer";

const res = await fetch("photo.png");
const bytes = new Uint8Array(await res.arrayBuffer());
const rgb = transform(bytes); // Uint8Array(768) — 16×16×3 raw RGB
```

Each pixel is 3 bytes (R, G, B). Pixels are in row-major order, 768 bytes total.

### Demo

A sample `index.html` is included. Note that the demo uses `--target web` for standalone use:

```console
$ wasm-pack build --target web --release
$ uv run python -m http.server
```

Open `http://localhost:8000` — pick an image and the 16×16 result renders on a canvas.
