# Board43 Sample: Button

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
