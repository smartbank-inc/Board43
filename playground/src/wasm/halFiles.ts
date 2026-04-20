/**
 * HAL (Hardware Abstraction Layer) Ruby file contents
 * These files provide a unified API for both device and emulator modes
 */

import { LED_MATRIX_CONFIG, type LedMatrixConfig } from './types';

/** HAL entry point - loads api and implementation */
export const HAL_ENTRY = `\
require_relative "hal/api"
require_relative "hal/impl"
`;

/**
 * Generate common API definitions - shared between device and emulator
 * @param config - LED matrix configuration
 */
export function createHalApi(
  config: LedMatrixConfig = LED_MATRIX_CONFIG,
): string {
  return `\
module HAL
  # LED matrix dimensions
  LED_WIDTH = ${config.width}
  LED_HEIGHT = ${config.height}
  LED_COUNT = ${config.count}

  # Internal pixel buffer for emulator display
  class PixelBuffer
    def initialize(n = ${config.count})
      @n = n
      @buf = Array.new(n * 3, 0) # RGB flat buffer
    end

    def set_pixels(colors)
      # colors is array of [r, g, b] arrays
      i = 0
      colors.each do |rgb|
        break if i >= @n
        @buf[i * 3]     = rgb[0]
        @buf[i * 3 + 1] = rgb[1]
        @buf[i * 3 + 2] = rgb[2]
        i = i + 1
      end
    end

    def clear
      @n.times do |i|
        @buf[i * 3]     = 0
        @buf[i * 3 + 1] = 0
        @buf[i * 3 + 2] = 0
      end
    end

    def to_a
      @buf
    end
  end

  def self.sleep_ms(ms)
    raise NotImplementedError
  end
end
`;
}

/** Common API definitions - uses default LED matrix config */
export const HAL_API = createHalApi();

/** Device implementation - used when running on actual hardware */
export const HAL_IMPL_DEVICE = `\
module HAL
  class NeoPixel
    def show
      # TODO: Replace with actual WS2812 driver call
      puts "[device] show \#{to_a.inspect}"
    end
  end

  def self.sleep_ms(ms)
    sleep ms / 1000.0
  end
end
`;

/**
 * Generate emulator implementation - uses JS interop for Canvas rendering
 * @param config - LED matrix configuration
 */
export function createHalImplEmulator(
  config: LedMatrixConfig = LED_MATRIX_CONFIG,
): string {
  return `\
require 'js'

# Global pixel buffer for the emulator display
$_pixel_buffer = HAL::PixelBuffer.new(${config.count})

module HAL
  def self.sleep_ms(ms)
    sleep ms / 1000.0
  end

  def self.send_frame
    # Build JSON string manually since PicoRuby has limited Array methods
    pixels = $_pixel_buffer.to_a
    parts = ""
    first = true
    pixels.each do |p|
      if first
        parts = p.to_s
        first = false
      else
        parts = parts + "," + p.to_s
      end
    end
    json = "[" + parts + "]"
    # Call JS function using method syntax
    JS.global.setPixelData(json)
  end
end

# ============================================
# Device compatibility - WS2812 LED driver
# Matches the picoruby-ws2812-plus API
# ============================================

class WS2812
  attr_reader :brightness

  def initialize(*args, pin: nil, num: HAL::LED_COUNT, order: :grb)
    @driver = args[0]
    @pin = pin
    @num = num
    @order = order
    @brightness = 5
    @buffer = Array.new(@num * 3, 0)
  end

  def set_rgb(index, r, g, b)
    return if index < 0 || index >= @num

    i = index * 3
    @buffer[i] = r & 0xFF
    @buffer[i + 1] = g & 0xFF
    @buffer[i + 2] = b & 0xFF
    nil
  end

  def set_hsb(index, h, s, b)
    r, g, b_rgb = hsb_to_rgb(h, s, b)
    set_rgb(index, r, g, b_rgb)
  end

  def set_hex(index, hex)
    r = (hex >> 16) & 0xFF
    g = (hex >> 8) & 0xFF
    b = hex & 0xFF
    set_rgb(index, r, g, b)
  end

  def fill(r, g, b)
    i = @num
    while 0 < i
      i = i - 1
      set_rgb(i, r, g, b)
    end
    nil
  end

  def brightness=(value)
    @brightness = [[value, 0].max, 100].min
  end

  def show
    colors = Array.new(@num)
    i = 0
    while i < @num
      base = i * 3
      colors[i] = [@buffer[base], @buffer[base + 1], @buffer[base + 2]]
      i = i + 1
    end
    $_pixel_buffer.set_pixels(colors)
    HAL.send_frame
    nil
  end

  def clear
    fill(0, 0, 0)
    show
  end

  def close
    @driver = nil
    nil
  end

  # Backward-compatible helpers for older examples that used the previous gem API.
  def show_rgb(*colors)
    i = 0
    colors.each do |rgb|
      set_rgb(i, rgb[0], rgb[1], rgb[2])
      i = i + 1
    end
    show
  end

  def show_hex(*colors)
    i = 0
    colors.each do |hex|
      set_hex(i, hex)
      i = i + 1
    end
    show
  end

  def show_hsb(*colors)
    i = 0
    colors.each do |hsb|
      set_hsb(i, hsb[0], hsb[1], hsb[2])
      i = i + 1
    end
    show
  end

  def hsb_to_rgb(h, s, b)
    h = h % 360
    s = s / 100.0
    b = b / 100.0
    if s == 0
      v = (b * 255).to_i
      return [v, v, v]
    end
    h = h / 60.0
    i = h.to_i
    f = h - i
    p = (b * (1 - s) * 255).to_i
    q = (b * (1 - s * f) * 255).to_i
    t = (b * (1 - s * (1 - f)) * 255).to_i
    v = (b * 255).to_i
    sector = i % 6
    if sector == 0
      [v, t, p]
    elsif sector == 1
      [q, v, p]
    elsif sector == 2
      [p, v, t]
    elsif sector == 3
      [p, q, v]
    elsif sector == 4
      [t, p, v]
    elsif sector == 5
      [v, p, q]
    else
      [0, 0, 0]
    end
  end
end

# PIODriver stub - used for WS2812 on RP2040/RP2350
class PIODriver
  def initialize(pin)
    @pin = pin
  end

  def write(bytes)
    # No-op in emulator
  end

  def close
    # No-op in emulator
  end
end

# RMTDriver stub - used for WS2812 on ESP32
class RMTDriver
  def initialize(pin, **kwargs)
    @pin = pin
  end

  def write(bytes)
    # No-op in emulator
  end
end

# PIO stub
class PIO
  def initialize(*args); end
end

# GPIO stub - matches picoruby-gpio bitflag API
class GPIO
  IN         = 0b0000001
  OUT        = 0b0000010
  HIGH_Z     = 0b0000100
  PULL_UP    = 0b0001000
  PULL_DOWN  = 0b0010000
  OPEN_DRAIN = 0b0100000
  ALT        = 0b1000000

  # IRQ event types (matches picoruby-irq)
  LEVEL_LOW  = 1
  LEVEL_HIGH = 2
  EDGE_FALL  = 4
  EDGE_RISE  = 8

  attr_reader :pin

  def initialize(pin, flags = 0, alt_function = 0)
    @pin = pin
    @flags = flags
    @value = (flags & PULL_UP) != 0 ? 1 : 0
  end

  def setmode(flags, alt_function = 0)
    @flags = flags
    nil
  end

  def value; @value; end
  def value=(v); @value = v; end
  def high; @value = 1; end
  def low; @value = 0; end
  def read; @value; end
  def write(v); @value = v; end

  # IRQ registration - no-op in simulator (no hardware events)
  def irq(event_type, **opts, &callback)
    IRQ::IRQInstance.new(self, event_type, callback)
  end
end

# IRQ module stub - simulator does not generate hardware events
module IRQ
  class IRQInstance
    attr_accessor :capture
    attr_reader :peripheral, :event_type

    def initialize(peripheral, event_type, callback)
      @peripheral = peripheral
      @event_type = event_type
      @callback = callback
      @enabled = true
    end

    def enabled?; @enabled; end
    def enable; prev = @enabled; @enabled = true; prev; end
    def disable; prev = @enabled; @enabled = false; prev; end
    def unregister; nil; end
    def call(event_type); nil; end
  end

  def self.process(max_count = 5); 0; end
  def self.register(*); 0; end
  def self.unregister(*); nil; end
end

# ADC stub
class ADC
  def initialize(pin)
    @pin = pin
  end

  def read; 0; end
  def read_voltage; 0.0; end
end

# Board43 pin map stub - mirrors picoruby-board43 constants
module Board43
  GPIO_BUZZER     = 11
  GPIO_SW5        = 12
  GPIO_SW6        = 13
  GPIO_SW4        = 14
  GPIO_SW3        = 15
  GPIO_IMU_SDA    = 16
  GPIO_IMU_SCL    = 17
  GPIO_LEDOUT     = 24
  GPIO_STATUS_LED = 25
end

# I2C stub
class I2C
  def initialize(unit: nil, sda_pin: nil, scl_pin: nil, frequency: 100000)
    @unit = unit
    @sda_pin = sda_pin
    @scl_pin = scl_pin
    @frequency = frequency
  end

  def read(address, length); ""; end
  def write(address, data); end
  def read_register(address, register, length); ""; end
  def write_register(address, register, data); end
end

# QMI8658 IMU sensor stub
class QMI8658
  def initialize(i2c)
    @i2c = i2c
    @phase = 0.0
  end

  # Taylor series approximation of sin (PicoRuby has no Math module)
  def sin_approx(x)
    while x > 3.14159
      x = x - 6.28318
    end
    while x < -3.14159
      x = x + 6.28318
    end
    x3 = x * x * x
    x5 = x3 * x * x
    x - x3 / 6.0 + x5 / 120.0
  end

  # Returns simulated acceleration data [x, y, z]
  # Simulates gentle swaying motion for demo
  def read_acceleration
    @phase = @phase + 0.05
    # Simulate a gentle sine wave motion
    x = sin_approx(@phase * 0.5) * 0.3
    y = sin_approx(@phase * 0.7 + 1.57) * 0.3  # cos = sin + pi/2
    z = 1.0
    [x, y, z]
  end

  # Returns simulated gyroscope data [x, y, z]
  def read_gyroscope
    [0.0, 0.0, 0.0]
  end
end

# LSM6DS3 IMU sensor stub - matches picoruby-lsm6ds3 API
class LSM6DS3
  ACC_RANGE_2G  = 0
  ACC_RANGE_16G = 1
  ACC_RANGE_4G  = 2
  ACC_RANGE_8G  = 3

  GYR_RANGE_250DPS  = 0
  GYR_RANGE_125DPS  = 1
  GYR_RANGE_500DPS  = 2
  GYR_RANGE_1000DPS = 4
  GYR_RANGE_2000DPS = 6

  ODR_POWER_DOWN = 0
  ODR_12_5HZ     = 1
  ODR_26HZ       = 2
  ODR_52HZ       = 3
  ODR_104HZ      = 4
  ODR_208HZ      = 5
  ODR_416HZ      = 6
  ODR_833HZ      = 7
  ODR_1660HZ     = 8

  attr_reader :address, :acc_range, :gyr_range

  def initialize(i2c, address: nil, acc_range: ACC_RANGE_4G, gyr_range: GYR_RANGE_250DPS, odr: ODR_104HZ)
    @i2c = i2c
    @address = address || 0x6A
    @acc_range = acc_range
    @gyr_range = gyr_range
    @odr = odr
    @phase = 0.0
  end

  def sin_approx(x)
    while x > 3.14159
      x = x - 6.28318
    end
    while x < -3.14159
      x = x + 6.28318
    end
    x3 = x * x * x
    x5 = x3 * x * x
    x - x3 / 6.0 + x5 / 120.0
  end

  def read_acceleration
    @phase = @phase + 0.05
    x = sin_approx(@phase * 0.5) * 0.3
    y = sin_approx(@phase * 0.7 + 1.57) * 0.3
    z = 1.0
    [x, y, z]
  end

  def read_gyroscope
    [0.0, 0.0, 0.0]
  end

  def read_temperature
    25.0
  end

  def read_all
    {
      acceleration: read_acceleration,
      gyroscope: read_gyroscope,
      temperature: read_temperature
    }
  end

  def reset; nil; end
end

# PWM stub
class PWM
  def initialize(pin, freq: 1000)
    @pin = pin
    @freq = freq
    @duty = 0
  end

  def duty; @duty; end
  def duty=(v); @duty = v; end
  def freq; @freq; end
  def freq=(v); @freq = v; end
end

# Common constants (also available via HAL::LED_COUNT)
NUM_LEDS = HAL::LED_COUNT
LED_WIDTH = HAL::LED_WIDTH
LED_HEIGHT = HAL::LED_HEIGHT

# Provide sleep_ms as a global function for compatibility
def sleep_ms(ms)
  HAL.sleep_ms(ms)
end
`;
}

/** Emulator implementation - uses default LED matrix config */
export const HAL_IMPL_EMULATOR = createHalImplEmulator();
