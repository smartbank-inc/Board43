# Firmware

## Submodules

- [PicoRuby](https://github.com/picoruby/picoruby) [`3.4.2`](https://github.com/picoruby/picoruby/tree/9b94521d56e6082793db861801546fc5808b5211)

R2P2 lives inside PicoRuby as the `picoruby-r2p2` mrbgem, and Pico SDK / Pico Extras are pulled in under it as nested submodules.

## Setup

### Install prerequisites (macOS)

```console
$ brew install cmake ruby gcc-arm-embedded
```

### Clone and setup

```console
$ git clone <repo-url>
$ cd <repo-dir>/firmware
$ ./setup.sh
```

This will initialize submodules, install dependencies, and apply [`picoruby.patch`](./picoruby.patch) to PicoRuby.

- Add custom gems ([picoruby-ws2812-plus](https://github.com/ksbmyk/picoruby-ws2812-plus), [picoruby-lsm6ds3](https://github.com/0x6b/picoruby-lsm6ds3))
- Turn on the status LED (GPIO 25, active-high) from C init so it stays lit while powered (GPIO 25 is excluded from the 17-29 safe-init loop to prevent it from being reset to input-pulldown)
- Skip autostart (wifi auto-connect, `app.mrb`/`app.rb`, DFU boot manager) when SW3 (GPIO 15) is held at boot, so you can recover to a shell if an autostarted app is misbehaving, or upload and run a new `app.rb`
- Wrap the boot app `load` in a rescue block so that crashes, script errors, or interrupts fall through to the shell instead of halting the device
- Include build time (`HHMMSS`) in the firmware filename and append an `-SB` suffix, so multiple builds on the same day are easy to distinguish

### Status LED patterns

| State                                  | Pattern                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Powered on, idle                       | Steady on                                                                |
| Autostart: `app.rb`/`app.mrb` detected | 10 even blinks (80 ms on / 80 ms off), then steady on while the app runs |
| SW3 held at boot (autostart skipped)   | 3 × (double flash 50 ms, 300 ms gap), then steady on                     |

## Build

```console
$ cd <repo-dir>/firmware/picoruby
$ export PICO_SDK_PATH="$(pwd)/mrbgems/picoruby-r2p2/lib/pico-sdk"
$ export PICO_EXTRAS_PATH="$(pwd)/mrbgems/picoruby-r2p2/lib/pico-extras"
$ rm -rf build/r2p2/picoruby/pico2  # rake ...:clean does not wipe the CMake cache
$ rake r2p2:picoruby:pico2:prod
```

The `.uf2` file will be generated in `build/r2p2/picoruby/pico2/prod/`.

## Release (CI build)

Pushing a tag shaped `firmware-YYYY-MM-DD-NN` triggers [`build-firmware.yml`](../.github/workflows/build-firmware.yml), which builds the UF2, uploads it as a workflow artifact, and creates a GitHub Release for the tag with the UF2 attached.

```console
$ git tag firmware-2026-04-15-01
$ git push origin firmware-2026-04-15-01
```

`NN` is a two-digit sequence for multiple builds on the same day (`01`, `02`, ...). The workflow also accepts manual runs via `workflow_dispatch` in the GitHub Actions UI.

Download the built UF2 from the Releases page, or via CLI:

```console
$ gh release download firmware-2026-04-15-01 --pattern '*.uf2'
```

## Flash

1. Connect USB to your Board43.
2. Hold `BOOT`, press `RUN`, then release both.
3. Make sure the mounted drive is named `RP2350`.
4. Copy the `.uf2` file to the mounted drive: `cp build/r2p2/picoruby/pico2/prod/R2P2-PICORUBY-*.uf2 /Volumes/RP2350/`.
5. Once the copy command finishes, press `RUN` to reset.
6. Make sure the mounted drive is now named `R2P2`.
7. Enjoy.

## Examples

```ruby
require 'ws2812-plus'
led = WS2812.new(pin: 24, num: 256)

offset = 0
loop do
  256.times do |i|
    hue = (i * 360 / 256 + offset) % 360
    led.set_hsb(i, hue, 100, 1)
  end
  led.show
  offset = (offset + 5) % 360
end
```
