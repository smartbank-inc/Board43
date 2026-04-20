# Board43 Sample: Status LED

# GP25, on by default
led = GPIO.new(Board43::GPIO_STATUS_LED, GPIO::OUT)

loop do
  # 0 = off, 1 = on
  led.write 0
  sleep 0.5
  led.write 1
  sleep 0.5
end
