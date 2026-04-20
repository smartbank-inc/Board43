# docs

Document compiler for the user guide.

## Prerequisites

- [Rust](https://www.rust-lang.org/)

## Usage

```sh
# Compile user-guide.typ to PDF
cargo run -- compile

# Compile and generate n-up PDF (e.g. 2 pages on 1 sheet, portrait)
cargo run -- compile --nup 1x2 --flip

# Watch for changes and open in browser
cargo run -- watch

# Format Typst files
cargo run -- format

# List available fonts
cargo run -- list-fonts
```

## Release (CI build)

Pushing a tag shaped `document-MAJOR.MINOR.PATCH` triggers [`build-document.yml`](../.github/workflows/build-document.yml), which compiles the reference manual and creates a GitHub Release for the tag with the PDF attached.

```console
$ git tag document-1.0.0
$ git push origin document-1.0.0
```

The workflow also accepts manual runs via `workflow_dispatch` in the GitHub Actions UI (manual runs build the PDF but do not create a release).

If a document release is published after a firmware release, keep the firmware release marked as "Latest release" on GitHub (uncheck "Set as the latest release" when creating the document release). The reference manual directs readers to [`releases/latest`](https://github.com/smartbank-inc/Board43/releases/latest) for firmware downloads, so that tag must continue to resolve to the shippable firmware build.

Download the released PDF from the Releases page, or via CLI:

```console
$ gh release download document-1.0.0 --pattern '*.pdf'
```
