# Firmware

## Submodules

- [PicoRuby](https://github.com/picoruby/picoruby) [`3.4.2`](https://github.com/picoruby/picoruby/tree/9b94521d56e6082793db861801546fc5808b5211)

R2P2 lives inside PicoRuby as the `picoruby-r2p2` mrbgem, and Pico SDK / Pico Extras are pulled in under it as nested submodules.

## Setup, Build, and Flash

See [docs](../docs) for detail.

## Release (CI build)

Pushing a tag shaped `firmware-YYYY-MM-DD-NN` triggers [`build-firmware.yml`](../.github/workflows/build-firmware.yml), which builds the UF2, uploads it as a workflow artifact, and creates a GitHub Release for the tag with the UF2 attached.

```console
$ git tag firmware-2026-04-15-01
$ git push origin firmware-2026-04-15-01
```

`NN` is a two-digit sequence for multiple builds on the same day (`01`, `02`, ...). The workflow also accepts manual runs via `workflow_dispatch` in the GitHub Actions UI.

Download the built UF2 from the [Releases](https://github.com/smartbank-inc/Board43-draft/releases) page, or via CLI:

```console
$ gh release download firmware-2026-04-15-01 --pattern '*.uf2'
```

## License

MIT. See [LICENSE](./LICENSE) for detail.
