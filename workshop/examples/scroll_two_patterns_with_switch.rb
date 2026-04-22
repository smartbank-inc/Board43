# Generated from two Board43 Playground patterns
#
# Concatenates pattern 1 and pattern 2 side by side and
# lets you switch display modes with buttons.
#
#   SW3: pattern 1
#   SW4: pattern 2
#   SW5: scroll right
#   SW6: pattern 1 scroll right

require 'ws2812-plus'
require 'i2c'
require 'lsm6ds3'

WIDTH = 16
HEIGHT = 16
TOTAL_WIDTH = WIDTH * 2

led = WS2812.new(pin: Board43::GPIO_LEDOUT, num: 256)
led.clear
sw3 = GPIO.new(Board43::GPIO_SW3, GPIO::IN | GPIO::PULL_UP)
sw4 = GPIO.new(Board43::GPIO_SW4, GPIO::IN | GPIO::PULL_UP)
sw5 = GPIO.new(Board43::GPIO_SW5, GPIO::IN | GPIO::PULL_UP)
sw6 = GPIO.new(Board43::GPIO_SW6, GPIO::IN | GPIO::PULL_UP)

delay_ms = 100

i2c = I2C.new(
  unit: :RP2040_I2C0,
  sda_pin: Board43::GPIO_IMU_SDA,
  scl_pin: Board43::GPIO_IMU_SCL,
  frequency: 400_000,
)
imu = LSM6DS3.new(i2c)
flip = false

pattern_a_rows = [
  '................',
  '................',
  '................',
  '.....RRRRRR.....',
  '....RHRRRRHR....',
  '...RHHRRRRHHR...',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRR..',
  '...RRRRRRRRRR...',
  '....RRRRRRRR....',
  '.....RRRRRR.....',
  '......RRRR......',
  '.......RR.......',
  '................',
  '................',
  '................',
]

pattern_b_rows = [
  '................',
  '.......YY.......',
  '.......YY.......',
  '......YYYY......',
  '......YYYY......',
  'YYYYYYYYYYYYYYYY',
  '.YYYYYYYYYYYYYY.',
  '..YYYYYYYYYYYY..',
  '...YYYYYYYYYY...',
  '....YYYYYYYY....',
  '.....YYYYYY.....',
  '......YYYY......',
  '.......YY.......',
  '................',
  '................',
  '................',
]

def color_for(char_code)
  case char_code
  when 82  # R
    [255, 30, 70]
  when 72  # H
    [255, 180, 200]
  when 89  # Y
    [255, 180, 0]
  else
    [0, 0, 0]
  end
end

def build_pattern(rows)
  pattern = []
  y = 0
  while y < rows.length
    row = []
    bytes = rows[y].bytes
    x = 0
    while x < bytes.length
      row << color_for(bytes[x])
      x += 1
    end
    pattern << row
    y += 1
  end
  pattern
end

def concat_patterns(left, right)
  combined = []
  y = 0
  while y < HEIGHT
    combined << (left[y] + right[y])
    y += 1
  end
  combined
end

pattern1 = build_pattern(pattern_a_rows)
pattern2 = build_pattern(pattern_b_rows)
pattern = concat_patterns(pattern1, pattern2)

def draw_pattern(led, pattern, flip)
  HEIGHT.times do |y|
    dst_y = flip ? HEIGHT - 1 - y : y
    WIDTH.times do |x|
      dst_x = flip ? WIDTH - 1 - x : x
      c = pattern[y][x]
      led.set_rgb(dst_y * WIDTH + dst_x, c[0], c[1], c[2])
    end
  end
end

def draw_scrolled_pattern(led, pattern, offset, flip, source_width)
  HEIGHT.times do |y|
    dst_y = flip ? HEIGHT - 1 - y : y
    WIDTH.times do |x|
      src_x = (x - offset + source_width) % source_width
      dst_x = flip ? WIDTH - 1 - x : x
      c = pattern[y][src_x]
      led.set_rgb(dst_y * WIDTH + dst_x, c[0], c[1], c[2])
    end
  end
end

mode = :scroll_right
prev_mode = mode
offset = 0

loop do
  mode = :pattern1 if sw3.low?
  mode = :pattern2 if sw4.low?
  mode = :scroll_right if sw5.low?
  mode = :pattern1_scroll_right if sw6.low?

  if mode != prev_mode
    offset = 0
    prev_mode = mode
  end

  acc = imu.read_all[:acceleration]
  flip = acc[0] < -0.5 if acc[0].abs > 0.5
  current_offset = offset

  case mode
  when :pattern1
    draw_pattern(led, pattern1, flip)
  when :pattern2
    draw_pattern(led, pattern2, flip)
  when :scroll_right
    draw_scrolled_pattern(led, pattern, current_offset, flip, TOTAL_WIDTH)
  when :scroll_left
    draw_scrolled_pattern(led, pattern, TOTAL_WIDTH - current_offset, flip, TOTAL_WIDTH)
  when :pattern1_scroll_right
    draw_scrolled_pattern(led, pattern1, current_offset, flip, WIDTH)
  end

  led.show
  if mode == :pattern1 || mode == :pattern2
    sleep_ms delay_ms
  elsif current_offset == 0
    sleep_ms 1000
  else
    sleep_ms delay_ms
  end

  if mode == :scroll_right || mode == :scroll_left
    offset += 1
    offset = 0 if offset >= TOTAL_WIDTH
  elsif mode == :pattern1_scroll_right
    offset += 1
    offset = 0 if offset >= WIDTH
  end
end
