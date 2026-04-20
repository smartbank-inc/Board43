# Board43 Sample: IMU

require 'i2c'
require 'lsm6ds3'

i2c = I2C.new(
unit: :RP2040_I2C0,
# GP16
sda_pin: Board43::GPIO_IMU_SDA,
# GP17
scl_pin: Board43::GPIO_IMU_SCL,
frequency: 400_000,
)
# 6-axis IMU
imu = LSM6DS3.new(i2c)

loop do
  data = imu.read_all
  # [ax, ay, az] in g
  a = data[:acceleration]
  # [gx, gy, gz] in dps
  g = data[:gyroscope]
  # degrees C
  t = data[:temperature]
  puts "acc: #{a[0]}, #{a[1]}, #{a[2]} " \
  "gyr: #{g[0]}, #{g[1]}, #{g[2]} " \
  "temp: #{t}"
  sleep 0.1
end
