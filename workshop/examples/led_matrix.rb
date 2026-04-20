# Board43 Sample: LED Matrix

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
