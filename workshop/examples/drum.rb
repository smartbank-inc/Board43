# Board43 Sample: Drum
#
# Press the buttons to play different drum sounds
# with unique visual effects on the LED matrix.
#
#   SW3: Low tone — expanding circle
#   SW4: Mid-low tone — full flash
#   SW5: Mid-high tone — random scatter
#   SW6: High tone — upward wave
#
# Features: Switches (IRQ) + WS2812 16x16 matrix + Buzzer (PWM)

require 'ws2812-plus'
require 'pwm'
require 'irq'  # Hardware interrupt for responsive button input

# Simple random number generator (PicoRuby has no built-in rand)
class SimpleRand
  def initialize(seed = 12345)
    @seed = seed
  end

  def rand(max)
    @seed = (@seed * 1103515245 + 12345) & 0x7fffffff
    @seed % max
  end
end

rng = SimpleRand.new
led = WS2812.new(pin: Board43::GPIO_LEDOUT, num: 256)

sw3 = GPIO.new(Board43::GPIO_SW3, GPIO::IN | GPIO::PULL_UP)
sw4 = GPIO.new(Board43::GPIO_SW4, GPIO::IN | GPIO::PULL_UP)
sw5 = GPIO.new(Board43::GPIO_SW5, GPIO::IN | GPIO::PULL_UP)
sw6 = GPIO.new(Board43::GPIO_SW6, GPIO::IN | GPIO::PULL_UP)

buzzer = PWM.new(Board43::GPIO_BUZZER, frequency: 0, duty: 50)

state = {
  effect: nil,
  effect_frame: 0,
  effect_hue: 0,
  tone_frame: 0,
  scatter_pixels: [],
  buzzer: buzzer,
  rng: rng
}

sw3.irq(GPIO::EDGE_FALL, debounce: 50, capture: state) do |gpio, event, cap|
  cap[:effect] = :circle
  cap[:effect_frame] = 12
  cap[:effect_hue] = 0
  cap[:buzzer].frequency(150)
  cap[:tone_frame] = 4
end

sw4.irq(GPIO::EDGE_FALL, debounce: 50, capture: state) do |gpio, event, cap|
  cap[:effect] = :flash
  cap[:effect_frame] = 12
  cap[:effect_hue] = 30
  cap[:buzzer].frequency(300)
  cap[:tone_frame] = 4
end

sw5.irq(GPIO::EDGE_FALL, debounce: 50, capture: state) do |gpio, event, cap|
  cap[:effect] = :scatter
  cap[:effect_frame] = 12
  cap[:effect_hue] = 180
  pixels = []
  i = 0
  while i < 40
    pixels << cap[:rng].rand(256)
    i += 1
  end
  cap[:scatter_pixels] = pixels
  cap[:buzzer].frequency(600)
  cap[:tone_frame] = 4
end

sw6.irq(GPIO::EDGE_FALL, debounce: 50, capture: state) do |gpio, event, cap|
  cap[:effect] = :wave
  cap[:effect_frame] = 12
  cap[:effect_hue] = 270
  cap[:buzzer].frequency(1200)
  cap[:tone_frame] = 4
end

loop do
  IRQ.process

  if state[:tone_frame] > 0
    state[:tone_frame] -= 1
    if state[:tone_frame] == 0
      buzzer.frequency(0)
    end
  end

  effect = state[:effect]
  effect_frame = state[:effect_frame]
  effect_hue = state[:effect_hue]

  if effect_frame > 0
    fade = effect_frame * 100 / 12

    case effect
    when :circle
      # Expanding circle from center
      radius = (12 - effect_frame) * 10 / 12
      row = 0
      while row < 16
        col = 0
        while col < 16
          idx = row * 16 + col
          dx = col - 7
          dy = row - 7
          dist = dx * dx + dy * dy
          r_inner = (radius - 2) * (radius - 2)
          r_outer = (radius + 1) * (radius + 1)
          if dist >= r_inner && dist <= r_outer
            led.set_hsb(idx, effect_hue, 100, fade)
          else
            led.set_rgb(idx, 0, 0, 0)
          end
          col += 1
        end
        row += 1
      end

    when :flash
      # Full flash with fade out
      i = 0
      while i < 256
        led.set_hsb(i, effect_hue, 80, fade)
        i += 1
      end

    when :scatter
      # Random scatter with fade out
      scatter_pixels = state[:scatter_pixels]
      led.fill(0, 0, 0)
      i = 0
      while i < scatter_pixels.length
        led.set_hsb(scatter_pixels[i], effect_hue, 100, fade)
        i += 1
      end

    when :wave
      # Upward wave
      wave_row = 15 - (12 - effect_frame) * 16 / 12
      row = 0
      while row < 16
        col = 0
        while col < 16
          idx = row * 16 + col
          dist = (row - wave_row).abs
          if dist < 3
            b = fade * (3 - dist) / 3
            led.set_hsb(idx, effect_hue, 100, b)
          else
            led.set_rgb(idx, 0, 0, 0)
          end
          col += 1
        end
        row += 1
      end
    end

    state[:effect_frame] -= 1
  else
    led.fill(0, 0, 0)
  end

  led.show
  sleep_ms 30
end
