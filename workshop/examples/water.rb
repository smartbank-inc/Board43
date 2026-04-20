# Board43 Sample: Water Simulation
#
# A 2D fluid simulation using cellular automaton.
# Tilt the board to make particles flow with gravity.
#
# Features: IMU (LSM6DS3TR-C) + WS2812 16x16 matrix

require 'ws2812-plus'
require 'i2c'
require 'lsm6ds3'

led = WS2812.new(pin: Board43::GPIO_LEDOUT, num: 256)
i2c = I2C.new(unit: :RP2040_I2C0, sda_pin: Board43::GPIO_IMU_SDA, scl_pin: Board43::GPIO_IMU_SCL, frequency: 400_000)
imu = LSM6DS3.new(i2c)

SIZE = 16
NUM_PARTICLES = 80
PASSES = 5
THRESHOLD = 0.15

# Place water particles at the bottom of the grid
grid = Array.new(SIZE * SIZE, 0)
cnt = 0
row = SIZE - 1
while row >= 0 && cnt < NUM_PARTICLES
  col = 0
  while col < SIZE && cnt < NUM_PARTICLES
    grid[row * SIZE + col] = 1
    cnt += 1
    col += 1
  end
  row -= 1
end

frame = 0

loop do
  # Determine gravity direction from tilt
  acc = imu.read_acceleration
  raw_gx = acc[1]
  raw_gy = acc[0]
  dx = 0
  dy = 0
  if raw_gx > THRESHOLD
    dx = 1
  elsif raw_gx < -THRESHOLD
    dx = -1
  end
  if raw_gy > THRESHOLD
    dy = 1
  elsif raw_gy < -THRESHOLD
    dy = -1
  end
  if dx == 0 && dy == 0
    dy = 1
  end

  # Update cellular automaton
  pass = 0
  while pass < PASSES
    alt = (frame + pass) % 2

    ri = 0
    while ri < SIZE
      if dy > 0
        r = SIZE - 1 - ri
      elsif dy < 0
        r = ri
      else
        r = SIZE - 1 - ri
      end

      ci = 0
      while ci < SIZE
        if alt == 0
          if dx >= 0
            c = SIZE - 1 - ci
          else
            c = ci
          end
        else
          if dx >= 0
            c = ci
          else
            c = SIZE - 1 - ci
          end
        end

        if grid[r * SIZE + c] == 1
          moved = 0

          # Rule 1: Diagonal (gravity direction)
          if moved == 0 && dx != 0 && dy != 0
            nr = r + dy
            nc = c + dx
            if nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE
              if grid[nr * SIZE + nc] == 0
                grid[r * SIZE + c] = 0
                grid[nr * SIZE + nc] = 1
                moved = 1
              end
            end
          end

          # Rule 2: Vertical
          if moved == 0 && dy != 0
            nr = r + dy
            if nr >= 0 && nr < SIZE
              if grid[nr * SIZE + c] == 0
                grid[r * SIZE + c] = 0
                grid[nr * SIZE + c] = 1
                moved = 1
              end
            end
          end

          # Rule 3: Horizontal
          if moved == 0 && dx != 0
            nc = c + dx
            if nc >= 0 && nc < SIZE
              if grid[r * SIZE + nc] == 0
                grid[r * SIZE + c] = 0
                grid[r * SIZE + nc] = 1
                moved = 1
              end
            end
          end

          # Rule 4: Gravity + lateral spread (fluid behavior)
          if moved == 0 && dy != 0
            nr = r + dy
            if nr >= 0 && nr < SIZE
              if alt == 0
                s1 = -1
                s2 = 1
              else
                s1 = 1
                s2 = -1
              end
              nc = c + s1
              if nc >= 0 && nc < SIZE && grid[nr * SIZE + nc] == 0
                grid[r * SIZE + c] = 0
                grid[nr * SIZE + nc] = 1
                moved = 1
              end
              if moved == 0
                nc = c + s2
                if nc >= 0 && nc < SIZE && grid[nr * SIZE + nc] == 0
                  grid[r * SIZE + c] = 0
                  grid[nr * SIZE + nc] = 1
                  moved = 1
                end
              end
            end
          end

          # Rule 5: Vertical spread under horizontal gravity
          if moved == 0 && dx != 0 && dy == 0
            nc = c + dx
            if nc >= 0 && nc < SIZE
              if alt == 0
                s1 = -1
                s2 = 1
              else
                s1 = 1
                s2 = -1
              end
              nr = r + s1
              if nr >= 0 && nr < SIZE && grid[nr * SIZE + nc] == 0
                grid[r * SIZE + c] = 0
                grid[nr * SIZE + nc] = 1
                moved = 1
              end
              if moved == 0
                nr = r + s2
                if nr >= 0 && nr < SIZE && grid[nr * SIZE + nc] == 0
                  grid[r * SIZE + c] = 0
                  grid[nr * SIZE + nc] = 1
                  moved = 1
                end
              end
            end
          end
        end

        ci += 1
      end
      ri += 1
    end
    pass += 1
  end

  # Draw water particles (brighter on surface)
  i = 0
  while i < SIZE * SIZE
    if grid[i] == 1
      sr = i / SIZE - dy
      sc = i % SIZE - dx
      if sr < 0 || sr >= SIZE || sc < 0 || sc >= SIZE || grid[sr * SIZE + sc] == 0
        led.set_hsb(i, 200, 100, 70)
      else
        led.set_hsb(i, 210, 100, 35)
      end
    else
      led.set_rgb(i, 0, 0, 0)
    end
    i += 1
  end

  led.show
  frame += 1
  sleep_ms 30
end
