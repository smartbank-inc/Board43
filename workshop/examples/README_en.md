[日本語](README.md)

# Board43 Sample Code

## Per-Sensor Samples

| File | Description | Features Used |
| --- | --- | --- |
| [status_led.rb](status_led.rb) | Toggle the status LED on/off | GPIO |
| [button.rb](button.rb) | Read button press state | Switches (GPIO) |
| [buzzer.rb](buzzer.rb) | Play and stop the buzzer | Buzzer (PWM) |
| [led_matrix.rb](led_matrix.rb) | Display a rainbow gradient on the LED matrix | LED (WS2812) |
| [imu.rb](imu.rb) | Print acceleration, gyroscope, and temperature to console | IMU (I2C) |

## Combined Samples

| File | Description | Features Used |
| --- | --- | --- |
| [water.rb](water.rb) | Tilt the board to make water flow — a fluid simulation | IMU + LED |
| [logo.rb](logo.rb) | RubyKaigi 2026 logo display with button-switchable background effects | Switches + LED + Buzzer |
| [scroll_two_patterns_right.rb](scroll_two_patterns_right.rb) | Concatenate two 16x16 patterns and scroll them to the right | LED |
| [scroll_two_patterns_with_switch.rb](scroll_two_patterns_with_switch.rb) | Switch between showing and scrolling two 16x16 patterns with buttons | Switches + LED |
| [drum.rb](drum.rb) | Play drums with 4 buttons | Switches (IRQ) + LED + Buzzer |
| [snake_game.rb](snake_game.rb) | Classic snake game controlled with buttons | Switches + LED + Buzzer |
| [theremin.rb](theremin.rb) | Tilt the board to play a musical scale | IMU + LED + Buzzer + Switches |
