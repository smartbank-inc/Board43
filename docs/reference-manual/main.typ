// ============================================================================
// Design tokens
// ============================================================================

#let black = rgb("#111111")
#let gray = rgb("#666666")
#let light = rgb("#f3f3f3")
#let line-color = rgb("#2b2b2b")
#let border = (paint: line-color, thickness: 0.7pt)

#let body-font = "Noto Sans JP"
#let mono-font = "JetBrains Mono NL"

// ============================================================================
// Document identity and reference-code numbering
// ============================================================================

#let edition = "1.0.0"

#let _sec-idx = counter("b43-section")
#let _sub-idx = counter("b43-subsection")

#let _fmt-code(sec, sub) = if sub == 0 {
  "B43-" + edition + "-" + str(sec)
} else {
  "B43-" + edition + "-" + str(sec) + "-" + str(sub)
}

// ============================================================================
// Helpers
// ============================================================================

#let hr(thickness: 0.7pt) = line(length: 100%, stroke: thickness + line-color)

#let zebra-row(..args) = table(
  inset: 5pt,
  stroke: border,
  fill: (x, y) => if y == 0 { light } else { white },
  ..args,
)

#let zebra-col(..args) = table(
  inset: 5pt,
  stroke: border,
  fill: (x, y) => if x == 0 { light } else { white },
  ..args,
)

#let plate(title, body) = block(
  width: 100%,
  stroke: border,
  inset: 8pt,
  fill: white,
  below: 10pt,
  breakable: false,
)[
  #block(below: 10pt, text(size: 8pt, weight: "bold", title))
  #body
]

#let note-row(label, body) = block(above: 10pt, below: 6pt, table(
  columns: (64pt, 1fr),
  inset: 5pt,
  stroke: border,
  fill: (x, y) => if x == 0 { light } else { white },
  align: (x, y) => if x == 0 { horizon + left } else { top + left },
  text(size: 8pt, weight: "bold", label), body,
))

#let btn(name) = box(
  fill: gray,
  radius: 2pt,
  inset: (x: 4pt, y: 1pt),
  outset: (y: 2pt),
  text(fill: white, raw(name)),
)

#let lcsc(code) = link(
  "https://www.lcsc.com/product-detail/" + code + ".html",
  raw(code),
)

// Start a new section: bump section counter, reset subsection counter, force a page break, emit a heading labelled by the given slug.
#let section(slug, title, outlined: true) = {
  pagebreak(weak: true)
  _sec-idx.step()
  _sub-idx.update(0)
  [#heading(level: 1, outlined: outlined, title)#label(slug)]
}

#let subsection(slug, title) = {
  _sub-idx.step()
  [#heading(level: 2, title)#label(slug)]
}

// Clickable cross-reference by slug; renders the auto-generated B43 code.
#let xref(slug) = context {
  let matches = query(selector(label(slug)))
  if matches.len() > 0 {
    let loc = matches.first().location()
    let s = _sec-idx.at(loc).first()
    let d = _sub-idx.at(loc).first()
    link(loc, raw(_fmt-code(s, d)))
  }
}

// ============================================================================
// Typography and heading styles
// ============================================================================

#set text(font: body-font, size: 9.2pt, stretch: 75%, fill: black)
#set par(justify: false, leading: 0.62em)
#show raw: set text(font: mono-font)
#show raw.where(block: true): it => {
  v(4pt)
  it
  v(4pt)
}
#show " × ": it => box(baseline: -0.6pt, text(size: 0.7em, it))
#set heading(numbering: none)

#show heading.where(level: 1): it => context {
  let s = _sec-idx.at(it.location()).first()
  let d = _sub-idx.at(it.location()).first()
  block(above: 0pt, below: 18pt, grid(
    columns: (1fr, auto),
    align: (left + bottom, right + bottom),
    text(font: mono-font, size: 16pt, weight: "bold", it.body),
    text(size: 5.6pt, fill: gray, weight: "regular", raw(_fmt-code(s, d))),
  ))
}

#show heading.where(level: 2): it => context {
  let s = _sec-idx.at(it.location()).first()
  let d = _sub-idx.at(it.location()).first()
  block(above: 24pt, below: 12pt, grid(
    columns: (1fr, auto),
    align: (left + bottom, right + bottom),
    text(font: mono-font, size: 10.5pt, weight: "bold", it.body),
    text(size: 5.6pt, fill: gray, weight: "regular", raw(_fmt-code(s, d))),
  ))
}

#show outline.entry.where(level: 1): it => context {
  let loc = it.element.location()
  let pg = counter(page).at(loc).first()
  block(below: 12pt, link(loc)[
    #grid(
      columns: (1fr, auto),
      gutter: 10pt,
      text(font: mono-font, size: 9.2pt, weight: "bold", it.element.body),
      text(font: mono-font, size: 9.2pt, weight: "bold", str(pg)),
    )
  ])
}

// ============================================================================
// Page setup: running header + footer driven by the current section heading
// ============================================================================

#set page(
  paper: "a4",
  margin: (top: 68pt, bottom: 42pt, left: 42pt, right: 42pt),
  header: context {
    let cur = here().page()
    let hs = query(heading.where(level: 1)).filter(h => (
      h.location().page() <= cur
    ))
    if hs.len() > 0 {
      let title = hs.last().body
      v(7pt)
      grid(
        columns: (1fr, auto),
        gutter: 8pt,
        [], text(font: mono-font, size: 9.8pt, weight: "bold", title),
      )
      v(5pt)
      hr(thickness: 0.8pt)
    }
  },
  numbering: "1",
  footer: context {
    let cur = here().page()
    let hs = query(heading.where(level: 1)).filter(h => (
      h.location().page() <= cur
    ))
    if hs.len() > 0 {
      align(center, text(
        font: mono-font,
        size: 10.5pt,
        weight: "bold",
        counter(page).display(),
      ))
    }
  },
)

// ============================================================================
// Front matter (cover)
// ============================================================================

#block(height: 100%, grid(
  columns: 1fr,
  rows: (auto, 0.3fr, auto, 0.5fr, auto),
  align: center,
  image("assets/smartbank-logo.svg", width: 160pt),
  [],
  [
    #text(font: mono-font, size: 38pt, weight: "bold", tracking: 1.8pt)[Board43]
    #v(-25pt)
    #text(size: 16pt)[Your own PicoRuby environment]
    #v(44pt)
    #text(size: 24pt, weight: "bold")[Reference Manual]
  ],
  [],
  image("assets/exploded.svg", width: 70%),
))

#pagebreak()

#align(center + horizon)[
  #text(size: 8pt, fill: gray, style: "italic")[This page is intentionally left blank.]
]

#pagebreak()

// ============================================================================
// Table of Contents
// ============================================================================

#counter(page).update(1)

#section(
  "toc",
  "Table of Contents",
  outlined: false,
)

#outline(title: none, depth: 1, indent: 0pt)

// Underline links in body content. Placed after the outline so TOC entries stay clean.
#show link: it => underline(stroke: 0.4pt + gray, offset: 2pt, it)

// ============================================================================
// Chapter 1
// ============================================================================

#section(
  "manual-info",
  "Important Manual Information",
)

This manual is intended to explain the current Board43 hardware to engineers, speakers, and demo builders.

#subsection("notations", "Notations")

Particularly important information is distinguished in this manual by the notations below. Treat each block according to the meaning defined here.

#note-row(
  "WARNING",
  [Indicates a risk of physical injury, hardware damage, or fire. Read the entire notice and follow its guidance before proceeding.],
)
#note-row(
  "NOTICE",
  [Calls out information that affects correct operation. Ignoring a notice is not dangerous but may lead to unexpected behavior or broken results.],
)
#note-row(
  "TIP",
  [Shares a practical suggestion or useful context. Not required for correctness, but worth knowing.],
)

#subsection("reference-codes", "Reference Codes")

Every section and subsection is tagged with a reference code in the form #raw("B43-<edition>-<section>[-<subsection>]"). The components are:

#zebra-col(
  columns: (auto, 1fr),
  [#raw("B43")],
  [Fixed product prefix, identifying the Board43 reference manual.],
  [#raw(edition)],
  [Manual edition in #raw("major.minor.patch") form. This printing is edition #raw(edition); later printings increment the numbers.],
  [#raw("section")],
  [1-based section index in document order.],
  [#raw("subsection")],
  [Optional 1-based index of the subsection within its section.],
)

#subsection("how-to-use", "How To Use This Manual")

- Use the section title at the top of the page as the functional category.
- Read the subsection title before using a pin, connector, or device.
- Treat every table as a stronger source of truth than surrounding prose.

#subsection("caution", "Caution")

#note-row(
  "WARNING",
  [The board has sharp edges. Handle and store with care to avoid injury.],
)
#note-row(
  "WARNING",
  [Running LEDs at maximum brightness for extended periods may cause overheating or fire.],
)
#note-row(
  "WARNING",
  [Some components contain lead. Wash your hands after handling.],
)

#subsection("disclaimer", "Disclaimer")

- SmartBank, Inc. ("we") makes no guarantees regarding the completeness, accuracy, or usefulness of the information provided, and offers no support.
- We assume no liability for any damage arising from the use, operation, downloading, or other actions related to the board or the information provided.

#section(
  "identification",
  "Identification",
)

#subsection("board-id", "Board Identification")

Board43 is a compact RP2350-based custom board with a full-face 16 × 16 RGB matrix, integrated motion sensing, local user controls, and a constrained but useful public expansion edge.

#grid(
  columns: (0.9fr, 1fr),
  gutter: 14pt,
  plate("Front")[
    #align(center + horizon)[#image("assets/front.svg", width: 100%)]
  ],
  [
    #plate("Board Data")[
      #set text(size: 8pt)
      #zebra-col(
        columns: (1fr, 1fr),
        [RP2350A],
        [#raw("U3") MCU],
        [Flash],
        [#raw("U5") W25Q32JVSS],
        [Accel / Gyro / Temp],
        [#raw("U6") LSM6DS3TR],
        [Status LED],
        [#raw("D2") on #raw("GP25")],
        [LED matrix],
        [256 × WS2812C-2020-V1],
        [USB-C],
        [#raw("USB1")],
        [System buttons],
        [#btn("BOOT"), #btn("RUN")],
        [User buttons],
        [#btn("SW3"), #btn("SW4"), #btn("SW5"), #btn("SW6")],
        [Buzzer],
        [#raw("BZ1") MLT-8530],
        [Debug SWD],
        [#raw("J1")],
        [Public header],
        [#raw("J2") 1 × 10],
        [Mounting hole],
        [M3 (3.2 mm)],
        [Board size],
        [53.98 × 85.6 mm],
      )
    ]
  ],
)

#note-row(
  "TIP",
  [The name Board43 honors B/43, SmartBank's prior consumer brand, now Onebank. Read phonetically in Japanese, 43 becomes 資産 (shisan, "assets") or 予算 (yosan, "budget"). In decimal ASCII, 43 is also the #raw("+") character, which frames the board as a place to add your own ideas on top of what it provides: hardware #raw("+") code #raw("+") creation. The 53.98 × 85.6 mm board outline matches the ISO/IEC 7810 ID-1 credit card size, another reference to our fintech heritage.],
)

#section(
  "system-controls",
  "System Controls",
)

#subsection("board-buttons", "Board Buttons")

#btn("BOOT") and #btn("RUN") are board-level controls, not user inputs. They are not routed to GPIO and cannot be read from PicoRuby.

#plate("Button Roles")[
  #zebra-row(
    columns: (auto, 1fr),
    [Button],
    [Function],
    [#btn("BOOT")],
    [Pulls the flash chip-select line low. The boot ROM samples this state at reset to decide whether to enter USB BOOTSEL mode.],
    [#btn("RUN")],
    [Pulls the RP2350 #raw("RUN") pin low. Resets the MCU while held.],
  )
]

#subsection("reset-sequences", "Reset Sequences")

#plate("Combinations")[
  #zebra-row(
    columns: (auto, 1fr),
    [Sequence],
    [Effect],
    [Hold #btn("BOOT"), press #btn("RUN"), release #btn("BOOT")],
    [Reboot into USB BOOTSEL mode. The board mounts as #raw("RP2350") mass storage for UF2 flashing.],
    [Hold #btn("SW3"), press #btn("RUN"), keep #btn("SW3") held until the status LED double-flashes 3 times],
    [Reboot with autostart skipped. Board43 firmware only; see #xref("disabling-autostart").],
  )
]

#subsection("status-led-patterns", "Status LED Patterns")

#plate("Status LED Behavior")[
  #zebra-row(
    columns: (0.8fr, 1.4fr),
    [State],
    [Pattern],
    [Powered on, idle],
    [Steady on],
    [Autostart: #raw("app.rb") / #raw("app.mrb") detected],
    [10 even blinks (80 ms on, 80 ms off), then steady on while the app runs],

    [#btn("SW3") held at boot (autostart skipped)],
    [3 × (double flash 50 ms, 300 ms gap), then steady on],
  )
]

#section(
  "features",
  "Features",
)

#subsection("system-outline", "System Outline")

The main function of Board43 is to provide a visually rich RP2350 target for PicoRuby demonstrations while keeping the hardware story legible. The board includes local control inputs, a motion sensor, and an LED pipeline that can remain internal or extend outward through the buffered #raw("LED OUT") line.

#plate("Functional Units")[
  #zebra-row(
    columns: (auto, 0.5fr, 1.5fr),
    [No.],
    [Unit],
    [Definition],
    [1],
    [MCU / clock / flash],
    [RP2350A, crystal, and 4MB external QSPI flash define the core compute path.],

    [2],
    [USB / protection],
    [USB-C enters through ESD protection and reaches the MCU USB interface while also feeding the board power path.],

    [3],
    [Power management],
    [A 5V load switch and a 3.3V regulator create the board rails used by the digital system.],

    [4],
    [Motion sensing],
    [The IMU is wired in I2C mode on #raw("GP16/GP17"). See #xref("imu").],

    [5],
    [User control],
    [Four user buttons plus BOOT and RUN create the immediate local input surface. See #xref("user-buttons") and #xref("board-buttons").],

    [6],
    [Display engine],
    [A 16 × 16 WS2812 matrix is driven from #raw("GPIO24") through a 5V level shifter. See #xref("led-matrix").],

    [7],
    [Expansion edge],
    [#raw("J2") exposes power, buffered LED data, and #raw("GP18..GP23"). See #xref("expansion-header").],

    [8],
    [Debug interface],
    [#raw("J1") exposes #raw("SWCLK"), #raw("SWDIO"), and #raw("GND") on a 3-pin JST SH connector. See #xref("debugging").],
  )
]

#subsection("wiring-facts", "Important Wiring Facts")

#note-row(
  "NOTICE",
  [The IMU interrupt pins are not routed.],
)
#note-row(
  "NOTICE",
  [The public LED signal is not raw MCU logic. It is the buffered 5V output after the level shifter.],
)
#note-row(
  "NOTICE",
  [#raw("GP25") is already assigned to the board status LED.],
)

#section(
  "picoruby-setup",
  "PicoRuby Setup",
)

#subsection("firmware-download", "Firmware Download")

#plate("Latest Release")[
  Download the latest Board43 firmware (UF2) from:

  - #link(
      "https://github.com/smartbank-inc/Board43/releases/latest",
    )[github.com/smartbank-inc/Board43/releases/latest]
]

#subsection("firmware-install", "Firmware Installation")

#grid(
  columns: (0.9fr, 1fr),
  gutter: 14pt,
  plate("Front")[
    #align(center + horizon)[#image("assets/front-usb-c.svg", width: 100%)]
  ],
  [
    #plate("Flash and Boot")[
      1. Connect Board43 to the host PC with a USB-C cable.
      2. Enter USB boot mode: hold #btn("BOOT"), press #btn("RUN"), then release #btn("BOOT") (see #xref("reset-sequences")). The board will appear as a USB mass-storage device.
      3. Copy the UF2 file to the device.
      4. The board reboots automatically. Connect to the serial console and launch #raw("irb").
    ]
  ],
)

#subsection("serial-connection", "Serial Connection")

#plate("Open the Serial Device")[
  After the board reboots, it appears as a USB CDC serial device. List candidates:

  ```sh
  $ ls /dev/tty.*
  ```

  Pick the matching entry (for example #raw("/dev/tty.usbmodem101")) and open it with #raw("picocom") (install with #raw("brew install picocom") if missing):

  ```sh
  $ picocom -b 115200 --imap lfcrlf /dev/tty.usbmodem101
  ```

  On Linux the device path is typically #raw("/dev/ttyACM*") instead.
]

#subsection("bring-up-commands", "Bring-Up Commands")

#plate("First Interactive Session")[
  Once the session is open, R2P2 shows its shell prompt. Type #raw("irb") to enter the interactive Ruby shell, where you can paste and run any of the validation snippets from #xref("validation").

  ```sh
  $> ls
  $> irb
  irb> puts "Hello PicoRuby!"
  Hello PicoRuby!
  => nil
  irb>
  ```

  Use the first session to confirm that the board is alive before committing to application code in #raw("/home/app.rb") or #raw("/home/app.mrb").
]

#subsection("disabling-autostart", "Disabling Auto-Start")

#plate("Cancel Auto-Start")[
  If #raw("/home/app.rb") or #raw("/home/app.mrb") exists, PicoRuby runs it automatically on boot. To cancel the auto-start, hold #btn("SW3"), press #btn("RUN"), and keep #btn("SW3") held until the status LED double-flashes 3 times (see #xref("reset-sequences") for the full list of reset sequences, and #xref("status-led-patterns") for the LED pattern). The board will then boot into the shell instead of the app.
]

#section(
  "gpio-pin-map",
  "GPIO Pin Map",
)

Each GPIO consumed by onboard hardware is exposed as a #raw("Board43::GPIO_*") constant. The validation examples in the next section rely on these constants, so prefer them over raw pin numbers in your own code.

#plate("Onboard GPIO Assignments")[
  #zebra-row(
    columns: (auto, 1fr, auto, auto),
    [Pin],
    [Current use],
    [Part],
    [Constant],
    [#raw("GP11")],
    [Buzzer driver through transistor stage],
    [#raw("Q1, BZ1")],
    [#raw("Board43::GPIO_BUZZER")],

    [#raw("GP12")],
    [User button],
    [#btn("SW5")],
    [#raw("Board43::GPIO_SW5")],
    [#raw("GP13")],
    [User button],
    [#btn("SW6")],
    [#raw("Board43::GPIO_SW6")],
    [#raw("GP14")],
    [User button],
    [#btn("SW4")],
    [#raw("Board43::GPIO_SW4")],
    [#raw("GP15")],
    [User button],
    [#btn("SW3")],
    [#raw("Board43::GPIO_SW3")],
    [#raw("GP16")],
    [IMU #raw("SDA"), with pull-up],
    [#raw("U6")],
    [#raw("Board43::GPIO_IMU_SDA")],

    [#raw("GP17")],
    [IMU #raw("SCL"), with pull-up],
    [#raw("U6")],
    [#raw("Board43::GPIO_IMU_SCL")],

    [#raw("GP24")],
    [Internal LED data source],
    [#raw("U4")],
    [#raw("Board43::GPIO_LEDOUT")],

    [#raw("GP25")],
    [Status LED],
    [#raw("D2")],
    [#raw("Board43::GPIO_STATUS_LED")],
  )
]

#note-row(
  "NOTICE",
  [The #raw("Board43::") constants are Ruby module constants defined in the Board43 custom firmware. They are available globally without #raw("require"), but are not part of stock PicoRuby and only exist when running the Board43 UF2.],
)

#note-row(
  "TIP",
  [#raw("GP18..GP23") are free GPIOs routed to the public expansion edge rather than an onboard peripheral. See #xref("expansion-header").],
)

#section(
  "validation",
  "Initial Validation Operations",
)

#subsection("status-led", "Status LED")

#grid(
  columns: (0.9fr, 1fr),
  gutter: 14pt,
  plate("Front")[
    #align(center + horizon)[#image("assets/front-status-led.svg", width: 100%)]
  ],
  [
    #plate("PicoRuby Example")[
      ```ruby
      # GP25, on by default
      led = GPIO.new(Board43::GPIO_STATUS_LED, GPIO::OUT)

      loop do
        # 0 = off, 1 = on
        led.write 0
        sleep 0.5
        led.write 1
        sleep 0.5
      end
      ```
    ]
    The on-board status LED blinks on and off every 0.5 seconds.
  ],
)

#subsection("user-buttons", "User Buttons")

#grid(
  columns: (0.9fr, 1fr),
  gutter: 14pt,
  plate("Front")[
    #align(center + horizon)[#image(
      "assets/front-user-buttons.svg",
      width: 100%,
    )]
  ],
  [
    #plate("PicoRuby Example")[
      ```ruby
      # active-low; SW3=GP15, SW4=GP14, SW5=GP12, SW6=GP13
      mode = GPIO::IN | GPIO::PULL_UP
      sw3 = GPIO.new(Board43::GPIO_SW3, mode)
      sw4 = GPIO.new(Board43::GPIO_SW4, mode)
      sw5 = GPIO.new(Board43::GPIO_SW5, mode)
      sw6 = GPIO.new(Board43::GPIO_SW6, mode)

      loop do
        # 0 when pressed, 1 when released
        puts "SW3=#{sw3.read} " \
             "SW4=#{sw4.read} " \
             "SW5=#{sw5.read} " \
             "SW6=#{sw6.read}"
        sleep 0.1
      end
      ```
    ]
    The terminal prints a line of four SW values every 0.1 s. Pressing a button flips its value from #raw("1") to #raw("0") while held.
  ],
)

#subsection("buzzer", "Buzzer")

#grid(
  columns: (0.9fr, 1fr),
  gutter: 14pt,
  plate("Front")[
    #align(center + horizon)[#image("assets/front-buzzer.svg", width: 100%)]
  ],
  [
    #plate("PicoRuby Example")[
      ```ruby
      require 'pwm'
      # GP11
      buzzer = PWM.new Board43::GPIO_BUZZER
      # A4 note (440 Hz), starts sound
      buzzer.frequency 440
      sleep 0.5
      # stops sound
      buzzer.duty 0
      ```
    ]
    The buzzer emits a 440 Hz (A4) tone for 0.5 seconds, then falls silent.
  ],
)

#subsection("led-matrix", "LED Matrix")

#grid(
  columns: (0.9fr, 1fr),
  gutter: 14pt,
  plate("Front")[
    #align(center + horizon)[#image("assets/front-led-matrix.svg", width: 100%)]
  ],
  [
    #plate("PicoRuby Example")[
      ```ruby
      require 'ws2812-plus'
      # GP24, 16x16 matrix
      led = WS2812.new(pin: Board43::GPIO_LEDOUT, num: 256)

      offset = 0
      loop do
        256.times do |i|
          # spread rainbow across all pixels
          hue = (i * 360 / 256 + offset) % 360
          # index, hue, saturation, brightness
          led.set_hsb(i, hue, 100, 50)
        end
        # flush buffer to LEDs
        led.show
        # rotate the pattern
        offset = (offset + 5) % 360
      end
      ```
    ]
    The 16 × 16 RGB matrix displays a full-spectrum rainbow that rotates continuously across all pixels.
  ],
)

#subsection("imu", "Accelerometer / Gyroscope / Temperature")

#grid(
  columns: (0.9fr, 1fr),
  gutter: 14pt,
  plate("Front")[
    #align(center + horizon)[#image("assets/front-imu.svg", width: 100%)]
  ],
  [
    #plate("PicoRuby Example")[
      ```ruby
      require 'i2c'
      require 'lsm6ds3'

      i2c = I2C.new(
        unit: :RP2040_I2C0,
        # GP16
        sda_pin: Board43::GPIO_IMU_SDA,
        # GP17
        scl_pin: Board43::GPIO_IMU_SCL,
        frequency: 400_000,
      )
      # 6-axis IMU
      imu = LSM6DS3.new(i2c)

      loop do
        data = imu.read_all
        # [ax, ay, az] in g
        a = data[:acceleration]
        # [gx, gy, gz] in dps
        g = data[:gyroscope]
        # degrees C
        t = data[:temperature]
        puts "acc: #{a[0]}, #{a[1]}, #{a[2]}  " \
             "gyr: #{g[0]}, #{g[1]}, #{g[2]}  " \
             "temp: #{t}"
        sleep 0.1
      end
      ```
    ]
    Move the board by hand while the loop runs. The terminal prints acceleration, gyroscope, and temperature readings every 0.1 s, and the values change as the board moves.
  ],
)

#section(
  "firmware-build",
  "Firmware Build",
)

This section is for builders who want to compile their own firmware from source instead of using the released UF2. The build target is R2P2 on RP2350 (pico2 / prod) from the pinned PicoRuby submodule.

#note-row(
  "NOTICE",
  [Prerequisites differ between macOS and Linux, but the build and flash flow is the same.],
)
#note-row(
  "NOTICE",
  [The firmware submodule is pinned. Updating PicoRuby to a newer commit may require re-applying or regenerating #raw("picoruby.patch").],
)

#subsection("source-tree", "Source Tree")

#plate("Submodule")[
  PicoRuby (version #raw("3.4.2"), pinned commit #raw("9b94521")) is vendored under #raw("firmware/picoruby"). R2P2 lives inside that tree as the #raw("picoruby-r2p2") mrbgem, and the Pico SDK and Pico Extras are pulled in as nested submodules beneath it.
]

#subsection("prerequisites", "Prerequisites and Setup")

#plate("macOS Setup")[
  ```sh
  $ brew install cmake ruby gcc-arm-embedded
  $ git clone https://github.com/smartbank-inc/Board43.git
  $ cd Board43/firmware
  $ ./setup.sh
  ```

]

#plate("Linux (Ubuntu) Setup")[
  ```sh
  $ sudo apt-get update
  $ sudo apt-get install -y ruby bundler cmake gcc-arm-none-eabi libnewlib-arm-none-eabi \
                            libstdc++-arm-none-eabi-newlib
  $ git clone https://github.com/smartbank-inc/Board43.git
  $ cd Board43/firmware
  $ ./setup.sh
  ```
]

#raw("./setup.sh") initializes submodules, installs dependencies, and applies #raw("picoruby.patch") to PicoRuby. The patch makes the following changes:

- Adds custom gems (#raw("picoruby-ws2812-plus"), #raw("picoruby-lsm6ds3"))
- Turns on the status LED on #raw("GP25") from C init
- Blinks the status LED 10 times before loading an auto-started app
- Lets #btn("SW3") held at boot skip autostart (wifi, #raw("app.mrb") / #raw("app.rb"), DFU boot manager)
- Wraps the boot load in a rescue block so script errors fall through to the shell
- Tags the firmware filename with the build time and an #raw("-SB") suffix

#subsection("build", "Build")

#plate("Build Commands")[
  ```sh
  $ cd Board43/firmware/picoruby
  $ export PICO_SDK_PATH="$(pwd)/mrbgems/picoruby-r2p2/lib/pico-sdk"
  $ export PICO_EXTRAS_PATH="$(pwd)/mrbgems/picoruby-r2p2/lib/pico-extras"
  $ rm -rf build/r2p2/picoruby/pico2
  $ rake r2p2:picoruby:pico2:prod
  ```

  The build produces #raw("R2P2-PICORUBY-*.uf2") under #raw("build/r2p2/picoruby/pico2/prod/").
]

#note-row(
  "NOTICE",
  [The explicit #raw("rm -rf") is required because the rake clean task does not wipe the CMake cache.],
)

#subsection("flash", "Flash")

#plate("Flash Procedure")[
  1. Connect USB to Board43.
  2. Enter USB boot mode: hold #btn("BOOT"), press #btn("RUN"), then release both (see #xref("reset-sequences")). The mounted drive should appear as #raw("RP2350").
  3. Copy the UF2 to the drive:

  ```sh
  $ cp build/r2p2/picoruby/pico2/prod/R2P2-PICORUBY-*.uf2 /Volumes/RP2350/
  ```

  4. When the copy finishes, press #btn("RUN") to reset.
]

#section(
  "debugging",
  "Debugging",
)

This section is for builders who want to flash and debug over SWD instead of the UF2 flow in #xref("firmware-build"). Using the SWD header requires an external debug probe; if you only plan to iterate on PicoRuby scripts, you can ignore this section.

#grid(
  columns: (0.9fr, 1fr),
  gutter: 14pt,
  plate("Front")[
    #align(center + horizon)[#image("assets/front-swd.svg", width: 100%)]
  ],
  [
    #plate("Raspberry Pi Debug Probe")[
      #raw("J1") is a 3-pin JST SH connector (#raw("BM03B-SRSS-TB")) carrying #raw("SWCLK"), #raw("SWDIO"), and #raw("GND"). The JST SH debug cable that ships with the Raspberry Pi Debug Probe plugs into #raw("J1") directly.

      For host setup, drivers, and OpenOCD usage, see the official documentation:

      - #link(
          "https://www.raspberrypi.com/documentation/microcontrollers/debug-probe.html",
        )[raspberrypi.com/documentation/microcontrollers/debug-probe.html]
    ]
  ],
)

#section(
  "expansion-header",
  "Expansion Header",
)

This section is for builders who want to extend the board through the public expansion edge. Using the header requires soldering; if you only plan to run code on the stock hardware, you can skip it.

#grid(
  columns: (0.9fr, 1fr),
  gutter: 14pt,
  plate("Back")[
    #align(center + horizon)[#image("assets/back.svg", width: 100%)]
  ],
  [
    #plate("J2 Pin Assignment")[
      #zebra-row(
        columns: (auto, 1fr),
        [Pin],
        [Signal],
        [1],
        [#raw("GND")],
        [2],
        [#raw("+5V")],
        [3],
        [#raw("+3V3")],
        [4],
        [#raw("LED OUT")],
        [5],
        [#raw("GP23")],
        [6],
        [#raw("GP22")],
        [7],
        [#raw("GP21")],
        [8],
        [#raw("GP20")],
        [9],
        [#raw("GP19")],
        [10],
        [#raw("GP18")],
      )
    ]
  ],
)

#note-row(
  "NOTICE",
  [#raw("J2") ships as bare through-hole pads. Solder a 1 × 10 2.54mm pin header (or wires) yourself before using the expansion edge.],
)

#note-row(
  "NOTICE",
  [#raw("GP0..GP10") and #raw("GP26..GP29") belong to the MCU but are not presented on the user header in the current PCB.],
)

// ============================================================================
// Appendix A
// ============================================================================

#section(
  "bom",
  "Bill of Materials",
)

#subsection("bom-ic", "IC / Module")

#plate("Active Components")[
  #zebra-row(
    columns: (auto, auto, auto, auto, 1fr),
    [Ref],
    [Value],
    [Package],
    [LCSC],
    [Description],
    [#raw("U1")],
    [LM73100RPWR],
    [Custom],
    [#lcsc("C3210761")],
    [Ideal Diode / Reverse Polarity Protection],

    [#raw("U2")],
    [TLV62568DBVR],
    [SOT-23-5],
    [#lcsc("C163219")],
    [Buck Converter],

    [#raw("U3")],
    [RP2350A],
    [Custom],
    [#lcsc("C42411118")],
    [MCU],
    [#raw("U4")],
    [SN74AHCT1G125DBVR],
    [SOT-23-5],
    [#lcsc("C7484")],
    [Single Bus Buffer Gate],

    [#raw("U5")],
    [W25Q32JVSS],
    [SOIC-8],
    [#lcsc("C82344")],
    [32Mbit SPI Flash],

    [#raw("U6")],
    [LSM6DS3TR],
    [LGA-14],
    [#lcsc("C95230")],
    [6-axis Accelerometer + Gyroscope],

    [#raw("U7")],
    [TPD2EUSB30A],
    [DRT-3],
    [#lcsc("C94934")],
    [USB ESD Protection],
  )
]

#subsection("bom-passive", "Passive Components")

#[
  #set text(size: 8.6pt)
  #grid(
    columns: (1fr, 1fr),
    gutter: 14pt,
    [
      #plate("Capacitors (283 pcs)")[
        #zebra-row(
          columns: (auto, auto, auto, auto),
          [Qty],
          [Value],
          [Pkg],
          [LCSC],
          [265],
          [100nF],
          [0201],
          [#lcsc("C668346")],
          [4],
          [100nF],
          [0402],
          [#lcsc("C1525")],
          [3],
          [10uF],
          [0603],
          [#lcsc("C2959727")],
          [2],
          [15pF],
          [0402],
          [#lcsc("C76950")],
          [1],
          [1uF],
          [0402],
          [#lcsc("C528974")],
          [5],
          [4.7uF],
          [0402],
          [#lcsc("C368809")],
          [1],
          [470pF],
          [0201],
          [#lcsc("C384950")],
          [2],
          [47uF],
          [1206],
          [#lcsc("C96123")],
        )
      ]
      #plate("Inductors")[
        #zebra-row(
          columns: (auto, auto, auto, auto),
          [Ref],
          [Value],
          [Pkg],
          [LCSC],
          [#raw("L1")],
          [2.2uH],
          [1008],
          [#lcsc("C1017131")],
          [#raw("L2")],
          [3.3uH],
          [Custom],
          [#lcsc("C42411119")],
        )
      ]
      #plate("Crystal")[
        #zebra-row(
          columns: (auto, auto, auto, auto),
          [Ref],
          [Value],
          [Pkg],
          [LCSC],
          [#raw("Y1")],
          [ABM8-272-T3],
          [3225],
          [#lcsc("C20625731")],
        )
      ]
    ],
    plate("Resistors (19 pcs)")[
      #zebra-row(
        columns: (auto, auto, auto, auto),
        [Ref],
        [Value],
        [Pkg],
        [LCSC],
        [#raw("R1, R2")],
        [5.1k],
        [0201],
        [#lcsc("C270344")],
        [#raw("R3")],
        [340k],
        [0402],
        [#lcsc("C423187")],
        [#raw("R4")],
        [32.4k],
        [0402],
        [#lcsc("C26974")],
        [#raw("R5, R7")],
        [100k],
        [0402],
        [#lcsc("C25741")],
        [#raw("R6")],
        [450k],
        [0402],
        [#lcsc("C5159688")],
        [#raw("R8")],
        [33],
        [0402],
        [#lcsc("C25105")],
        [#raw("R9, R10")],
        [27],
        [0201],
        [#lcsc("C473051")],
        [#raw("R11, R13, R14")],
        [1k],
        [0201],
        [#lcsc("C270365")],
        [#raw("R12")],
        [5.6k],
        [0201],
        [#lcsc("C423481")],
        [#raw("R15, R16")],
        [10k],
        [0201],
        [#lcsc("C270334")],
        [#raw("R17")],
        [2.2k],
        [0402],
        [#lcsc("C25879")],
        [#raw("R18")],
        [22k],
        [0402],
        [#lcsc("C25768")],
        [#raw("R19")],
        [470],
        [0201],
        [#lcsc("C473464")],
      )
    ],
  )
]

#subsection("bom-conn", "Electromechanical and Connectors")

#[
  #set text(size: 8.6pt)
  #grid(
    columns: (1fr, 1fr),
    gutter: 14pt,
    plate("LEDs (257 pcs)")[
      #zebra-row(
        columns: (auto, auto, auto, auto),
        [Ref],
        [Value],
        [Pkg],
        [LCSC],
        [#raw("D2")],
        [Status LED],
        [KT-0603W],
        [#lcsc("C2290")],
        [#raw("LED1..256")],
        [WS2812C-2020-V1],
        [Custom],
        [#lcsc("C2976072")],
      )
    ],
    plate("Diodes")[
      #zebra-row(
        columns: (auto, auto, auto, auto),
        [Ref],
        [Value],
        [Pkg],
        [LCSC],
        [#raw("D1")],
        [SMF5.0A (TVS)],
        [SOD-123F],
        [#lcsc("C193402")],
        [#raw("D3")],
        [US1MW],
        [SOD-123F],
        [#lcsc("C116132")],
      )
    ],
  )

  #grid(
    columns: (1fr, 1fr),
    gutter: 14pt,
    plate("Switches (6 pcs)")[
      #zebra-row(
        columns: (auto, auto, auto, auto),
        [Ref],
        [Value],
        [Pkg],
        [LCSC],
        [#raw("SW1..SW6")],
        [SKRPACE010],
        [Custom],
        [#lcsc("C139797")],
      )
    ],
    plate("Other")[
      #zebra-row(
        columns: (auto, auto, auto, auto),
        [Ref],
        [Value],
        [Pkg],
        [LCSC],
        [#raw("Q1")],
        [S9013 (NPN)],
        [SOT-23],
        [#lcsc("C727139")],
        [#raw("BZ1")],
        [MLT-8530],
        [Custom],
        [#lcsc("C94599")],
      )
    ],
  )

  #plate("Connectors")[
    #zebra-row(
      columns: (auto, auto, auto, auto),
      [Ref],
      [Value],
      [Package],
      [LCSC],
      [#raw("USB1")],
      [TYPE-C 16PIN],
      [Custom],
      [#lcsc("C393939")],
      [#raw("J1")],
      [BM03B-SRSS-TB],
      [Custom],
      [#lcsc("C160389")],
      [#raw("J2")],
      [Pin Header 1 × 10 2.54mm],
      [Through-hole],
      [--],
    )
  ]
]

#note-row(
  "NOTICE",
  [All parts have LCSC part numbers except #raw("J2") (standard pin header).],
)

// ============================================================================
// Back matter (edition plate)
// ============================================================================

#pagebreak()
#set page(header: none, footer: none)

#block(height: 1fr)[
  #v(22pt)
  #hr(thickness: 1pt)
]

#align(center)[
  #block(
    stroke: border,
    inset: 14pt,
    fill: white,
  )[
    #text(size: 11pt, weight: "bold")[Edition #edition]
    #v(3pt)
    #text(
      size: 9pt,
      datetime.today().display("[month repr:long] [day], [year]"),
    )
    #v(8pt)
    #text(size: 8.8pt)[Prepared for RubyKaigi 2026]
    #v(8pt)
    #text(
      size: 8pt,
    )[#sym.copyright #datetime.today().display("[year]") SmartBank, Inc.]
  ]
]
