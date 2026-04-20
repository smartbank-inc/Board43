# Board43 Sample: Buzzer

require 'pwm'

# GP11
buzzer = PWM.new Board43::GPIO_BUZZER
# A4 note (440 Hz), starts sound
buzzer.frequency 440
sleep 0.5
# stops sound
buzzer.duty 0
