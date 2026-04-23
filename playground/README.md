# Board43 Playground

A browser-based PicoRuby IDE for the Board43.

## Features

### Editor

- Multi-file tabs with CodeMirror 6 (Ruby syntax highlighting)
- Create, open from device, and download files
- Context menu (cut/copy/paste)
- Inline LED simulator panel
  - Run Ruby code in-browser via PicoRuby WASM
  - 16x16 LED matrix preview
  - Pixel paint editor with color picker, undo/redo
  - Image upload (converts to LED pixel data, via [board43-image-transformer](./lib/board43-image-transformer) WASM)
  - Animation modes: Static, Scroll (Left/Right/Up/Down), Fade, Rotate

### Device Connection

- Web Serial API for Board43 hardware
- Setup wizard with serial port selection and baud rate configuration
- Run code on device / stop (Ctrl-C)
- Install as startup program (`/home/app.rb`)

### Terminal

- Ghostty-based serial console

### General

- Language support: English / Japanese
- Simulator-only mode (no device required)

## Getting started

Requires Node.js and `pnpm`.

```bash
pnpm install
pnpm dev
```

Open the printed URL in Chrome or Edge. Web Serial API is required for the
device features; the simulator works in any modern browser.

### Build

```bash
pnpm build
```

Emits a static SPA to `dist/`. Serve it with any static host.

## License

MIT. See [LICENSE](./LICENSE) for detail.
