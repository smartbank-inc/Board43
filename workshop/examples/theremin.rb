# Board43 Sample: Theremin
#
# Tilt the board to play notes from an 8-tone scale.
# The corresponding LED columns light up.
#
#   SW3: Lower octave
#   SW4: Toggle sound ON/OFF
#   SW5: Replay current note
#   SW6: Raise octave
#
# Features: IMU (LSM6DS3TR-C) + WS2812 16x16 matrix + Buzzer (PWM) + Switches (GPIO)

require 'ws2812-plus'
require 'i2c'
require 'lsm6ds3'
require 'pwm'

led = WS2812.new(pin: Board43::GPIO_LEDOUT, num: 256)
i2c = I2C.new(unit: :RP2040_I2C0, sda_pin: Board43::GPIO_IMU_SDA, scl_pin: Board43::GPIO_IMU_SCL, frequency: 400_000)
imu = LSM6DS3.new(i2c)
buzzer = PWM.new(Board43::GPIO_BUZZER, frequency: 0, duty: 50)

sw3 = GPIO.new(Board43::GPIO_SW3, GPIO::IN | GPIO::PULL_UP)
sw4 = GPIO.new(Board43::GPIO_SW4, GPIO::IN | GPIO::PULL_UP)
sw5 = GPIO.new(Board43::GPIO_SW5, GPIO::IN | GPIO::PULL_UP)
sw6 = GPIO.new(Board43::GPIO_SW6, GPIO::IN | GPIO::PULL_UP)

# C major scale, 1 octave
base_notes = [262, 294, 330, 349, 392, 440, 494, 523]
NUM_NOTES = 8

hues = []
i = 0
while i < NUM_NOTES
  hues << i * 44
  i += 1
end

octave = 0
playing = true
prev_pos = -1
settle = 0
settle_thresh = 3
tone_frame = 0
sounded_pos = -1
sw5_prev = true

loop do
  # Map tilt to note position (0-7)
  acc = imu.read_acceleration
  tilt = acc[1]
  pos = ((tilt + 1.0) * 400).to_i
  pos = pos / 100
  pos = 0 if pos < 0
  pos = 7 if pos > 7

  if sw3.low?
    octave -= 1 if octave > -1
    sleep_ms 200
  end
  if sw6.low?
    octave += 1 if octave < 1
    sleep_ms 200
  end

  if sw4.low?
    playing = !playing
    buzzer.frequency(0) unless playing
    sleep_ms 200
  end

  sw5_now = sw5.low?
  if sw5_now && !sw5_prev && playing
    freq = base_notes[pos]
    if octave > 0
      freq = freq * 2
    elsif octave < 0
      freq = freq / 2
    end
    buzzer.frequency(freq)
    tone_frame = 3
  end
  sw5_prev = sw5_now

  if pos == prev_pos
    settle += 1
  else
    settle = 0
    prev_pos = pos
  end

  if playing && settle == settle_thresh && pos != sounded_pos
    freq = base_notes[pos]
    if octave > 0
      freq = freq * 2
    elsif octave < 0
      freq = freq / 2
    end
    buzzer.frequency(freq)
    tone_frame = 5
    sounded_pos = pos
  end

  if tone_frame > 0
    tone_frame -= 1
    if tone_frame == 0
      buzzer.frequency(0)
    end
  end

  # Draw: light up 2 columns for the current note
  led.fill(0, 0, 0)
  if playing
    col = pos * 2
    row = 0
    while row < 16
      led.set_hsb(row * 16 + col, hues[pos], 100, 50)
      led.set_hsb(row * 16 + col + 1, hues[pos], 100, 50)
      row += 1
    end
  end
  led.show
  sleep_ms 30
end
