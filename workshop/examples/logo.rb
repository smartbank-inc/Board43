# Board43 Sample: Logo + Background Effects
#
# Displays the RubyKaigi 2026 logo on the LED matrix
# and switches background effects with buttons.
# A beep sounds on mode change.
#
#   SW3: Hologram
#   SW4: Breathing
#   SW5: Stripe
#   SW6: Logo Rainbow
#
# Features: Switches (GPIO) + WS2812 16x16 matrix + Buzzer (PWM)

require 'ws2812-plus'
require 'pwm'

led = WS2812.new(pin: Board43::GPIO_LEDOUT, num: 256)
buzzer = PWM.new(Board43::GPIO_BUZZER, frequency: 0, duty: 10)
sw3 = GPIO.new(Board43::GPIO_SW3, GPIO::IN | GPIO::PULL_UP)
sw4 = GPIO.new(Board43::GPIO_SW4, GPIO::IN | GPIO::PULL_UP)
sw5 = GPIO.new(Board43::GPIO_SW5, GPIO::IN | GPIO::PULL_UP)
sw6 = GPIO.new(Board43::GPIO_SW6, GPIO::IN | GPIO::PULL_UP)

# Logo bitmap (# = background, . = logo)
logo_bitmap = [
  ".##.##.##.......", # row 0
  "##.##.##.#######", # row 1
  "#.##.##.........", # row 2
  ".##.##.#########", # row 3
  "##.##...........", # row 4
  ".###.######.##.#", # row 5
  "#.#.########.##.", # row 6
  "##.##########.##", # row 7
  ".##.########.#.#", # row 8
  "#.##.######.###.", # row 9
  "##.##.####.##.##", # row 10
  ".##.##.##.##.##.", # row 11
  "#.##.##..##.##.#", # row 12
  "##.##.#.##.##.##", # row 13
  ".##.##.##.##.##.", # row 14
  "#.###.##.##.##.#"  # row 15
]

logo = Array.new(256, false)
row = 0
while row < 16
  bytes = logo_bitmap[row].bytes
  col = 0
  while col < 16
    logo[row * 16 + col] = true if bytes[col] == 35  # '#'
    col += 1
  end
  row += 1
end

mode = :hologram
prev_mode = :hologram
frame = 0
tone_frame = 0

loop do
  mode = :hologram      if sw3.low?
  mode = :breathing     if sw4.low?
  mode = :stripe        if sw5.low?
  mode = :logo_rainbow  if sw6.low?

  if mode != prev_mode
    buzzer.frequency(2000)
    tone_frame = 2
    prev_mode = mode
  end

  if tone_frame > 0
    tone_frame -= 1
    if tone_frame == 0
      buzzer.frequency(0)
    end
  end

  row = 0
  while row < 16
    col = 0
    while col < 16
      idx = row * 16 + col

      if mode == :logo_rainbow
        # Logo Rainbow: rainbow logo on black background
        if logo[idx]
          led.set_rgb(idx, 0, 0, 0)
        else
          hue = (col * 22 + row * 10 + frame * 3) % 360
          led.set_hsb(idx, hue, 100, 50)
        end
      else
        if logo[idx]
          case mode
          when :hologram
            # Hologram: shifting colors
            hue = (row * 30 + col * 20 + frame * 2) % 260 + 60
            led.set_hsb(idx, hue, 100, 30)

          when :breathing
            # Breathing: pulsing red
            b = frame % 100
            b = 100 - b if b > 50
            led.set_hsb(idx, 0, 100, b * 2)

          when :stripe
            # Stripe: diagonal scrolling stripes
            s = ((row + col + frame) / 3) % 2
            if s == 0
              led.set_hsb(idx, 300, 80, 30)
            else
              led.set_hsb(idx, 160, 80, 30)
            end
          end
        else
          led.set_rgb(idx, 150, 150, 150)
        end
      end
      col += 1
    end
    row += 1
  end

  led.show
  frame += 1
  frame = 0 if frame > 10000
  sleep_ms 30
end
