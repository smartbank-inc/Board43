# docs

Reference manual and its compiler.

## Prerequisites

- [Rust](https://www.rust-lang.org/)

## Usage

```console
$ cargo run -- compile
```

## Release (CI build)

Pushing a tag shaped `document-MAJOR.MINOR.PATCH` triggers [`build-document.yml`](../.github/workflows/build-document.yml), which compiles the reference manual and creates a GitHub Release for the tag with the PDF attached.

```console
$ git tag document-1.0.0
$ git push origin document-1.0.0
```

The workflow also accepts manual runs via `workflow_dispatch` in the GitHub Actions UI (manual runs build the PDF but do not create a release).

If a document release is published after a firmware release, keep the firmware release marked as "Latest release" on GitHub (uncheck "Set as the latest release" when creating the document release). The reference manual directs readers to [`releases/latest`](https://github.com/smartbank-inc/Board43/releases/latest) for firmware downloads, so that tag must continue to resolve to the shippable firmware build.

Download the released PDF from the [Releases](https://github.com/smartbank-inc/Board43-draft/releases) page, or via CLI:

```console
$ gh release download document-1.0.0 --pattern '*.pdf'
```

## License

Source code (the document compiler) is licensed under the MIT. See [LICENSE](./LICENSE) for detail.

Document content (the reference manual text and assets) is licensed under [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/). Product names, trademarks, and registered trademarks referenced in this manual are the property of their respective owners. The license above does not grant any rights to use them.
