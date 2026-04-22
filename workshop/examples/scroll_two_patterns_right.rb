# Board43 Sample: Scroll Two Patterns to the Right
#
# Concatenates two 16x16 patterns into one 16x32 canvas
# and scrolls the visible 16x16 window to the right.
#
# Features: WS2812 16x16 matrix

require 'ws2812-plus'

WIDTH = 16
HEIGHT = 16
TOTAL_WIDTH = WIDTH * 2
DELAY_MS = 120

led = WS2812.new(pin: Board43::GPIO_LEDOUT, num: WIDTH * HEIGHT)
led.clear

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

pattern = concat_patterns(
  build_pattern(pattern_a_rows),
  build_pattern(pattern_b_rows),
)

offset = 0

loop do
  y = 0
  while y < HEIGHT
    x = 0
    while x < WIDTH
      src_x = (x - offset + TOTAL_WIDTH) % TOTAL_WIDTH
      c = pattern[y][src_x]
      led.set_rgb(y * WIDTH + x, c[0], c[1], c[2])
      x += 1
    end
    y += 1
  end

  led.show
  sleep_ms(offset == 0 ? 1000 : DELAY_MS)

  offset += 1
  offset = 0 if offset >= TOTAL_WIDTH
end
