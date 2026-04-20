# Board43 Sample: Snake Game
#
# Classic snake game controlled with buttons.
#
#   SW3: Left
#   SW4: Up
#   SW5: Down
#   SW6: Right
#
# Features: Switches (GPIO) + WS2812 16x16 matrix + Buzzer (PWM)

require "ws2812-plus"
require "gpio"
require "pwm"

# Simple random number generator (PicoRuby has no built-in rand)
class SimpleRand
  def initialize(seed = 12345)
    @seed = seed
  end

  def rand(max)
    @seed = (@seed * 1103515245 + 12345) & 0x7fffffff
    @seed % max
  end
end

led = WS2812.new(pin: Board43::GPIO_LEDOUT, num: 256)

btn_up    = GPIO.new(Board43::GPIO_SW4, GPIO::IN | GPIO::PULL_UP)
btn_down  = GPIO.new(Board43::GPIO_SW5, GPIO::IN | GPIO::PULL_UP)
btn_left  = GPIO.new(Board43::GPIO_SW3, GPIO::IN | GPIO::PULL_UP)
btn_right = GPIO.new(Board43::GPIO_SW6, GPIO::IN | GPIO::PULL_UP)

buzzer = PWM.new(Board43::GPIO_BUZZER, frequency: 0, duty: 50)

COLS = 16
ROWS = 16

DIR_UP    = [0, -1]
DIR_DOWN  = [0, 1]
DIR_LEFT  = [-1, 0]
DIR_RIGHT = [1, 0]

COLOR_HEAD  = [0, 255, 0]
COLOR_BODY  = [0, 120, 0]
COLOR_FOOD  = [255, 0, 0]

SPEED_INITIAL = 400
SPEED_MIN     = 120
SPEED_STEP    = 10

def xy_to_index(x, y)
  y * COLS + x
end

def beep(buzzer, freq, duration_ms)
  buzzer.frequency(freq)
  sleep_ms duration_ms
  buzzer.frequency(0)
end

def draw(led, snake, food)
  led.fill(0, 0, 0)

  idx = xy_to_index(food[0], food[1])
  led.set_rgb(idx, COLOR_FOOD[0], COLOR_FOOD[1], COLOR_FOOD[2])

  i = 0
  body_end = snake.length - 2
  while i <= body_end
    seg = snake[i]
    idx = xy_to_index(seg[0], seg[1])
    led.set_rgb(idx, COLOR_BODY[0], COLOR_BODY[1], COLOR_BODY[2])
    i += 1
  end

  head = snake[snake.length - 1]
  idx = xy_to_index(head[0], head[1])
  led.set_rgb(idx, COLOR_HEAD[0], COLOR_HEAD[1], COLOR_HEAD[2])

  led.show
end

def place_food(rng, snake)
  while true
    x = rng.rand(COLS - 2) + 1
    y = rng.rand(ROWS - 2) + 1
    occupied = false
    i = 0
    while i < snake.length
      if snake[i][0] == x && snake[i][1] == y
        occupied = true
        break
      end
      i += 1
    end
    return [x, y] unless occupied
  end
end

def game_over_animation(led, buzzer)
  count = 0
  while count < 3
    led.fill(255, 0, 0)
    led.show
    sleep_ms 150
    led.clear
    sleep_ms 150
    count += 1
  end
  beep(buzzer, 400, 150)
  beep(buzzer, 300, 150)
  beep(buzzer, 200, 300)
end

def show_score(led, snake, score)
  if score == 0
    return
  end
  led.fill(0, 0, 0)

  i = 0
  body_end = snake.length - 2
  while i <= body_end
    seg = snake[i]
    idx = xy_to_index(seg[0], seg[1])
    led.set_rgb(idx, COLOR_BODY[0], COLOR_BODY[1], COLOR_BODY[2])
    i += 1
  end
  head = snake[snake.length - 1]
  idx = xy_to_index(head[0], head[1])
  led.set_rgb(idx, COLOR_HEAD[0], COLOR_HEAD[1], COLOR_HEAD[2])

  # Show score on top row
  i = 0
  while i < score && i < COLS
    idx = xy_to_index(i, 0)
    led.set_rgb(idx, COLOR_FOOD[0], COLOR_FOOD[1], COLOR_FOOD[2])
    i += 1
  end

  led.show
end

loop do
  snake = [[6, 8], [7, 8], [8, 8]]
  score = 0
  game_running = true

  # Wait for button press to start
  led.fill(0, 0, 0)
  head = snake[snake.length - 1]
  idx = xy_to_index(head[0], head[1])
  led.set_rgb(idx, COLOR_HEAD[0], COLOR_HEAD[1], COLOR_HEAD[2])
  i = 0
  body_end = snake.length - 2
  while i <= body_end
    seg = snake[i]
    idx = xy_to_index(seg[0], seg[1])
    led.set_rgb(idx, COLOR_BODY[0], COLOR_BODY[1], COLOR_BODY[2])
    i += 1
  end
  led.show

  wait_count = 0
  direction = nil
  while direction.nil?
    if btn_up.low?
      direction = DIR_UP
    elsif btn_down.low?
      direction = DIR_DOWN
    elsif btn_right.low?
      direction = DIR_RIGHT
    end
    wait_count += 1
    sleep_ms 50
  end
  next_direction = direction

  rng = SimpleRand.new(wait_count)
  food = place_food(rng, snake)

  draw(led, snake, food)
  sleep_ms 200

  while game_running
    head = snake[snake.length - 1]
    head_x = head[0] + direction[0]
    head_y = head[1] + direction[1]

    if head_x < 0 || head_x >= COLS || head_y < 0 || head_y >= ROWS
      game_running = false
      next
    end

    i = 0
    while i < snake.length
      if snake[i][0] == head_x && snake[i][1] == head_y
        game_running = false
        break
      end
      i += 1
    end
    next unless game_running

    snake.push([head_x, head_y])

    ate_food = false
    if head_x == food[0] && head_y == food[1]
      score += 1
      ate_food = true
      food = place_food(rng, snake)
    else
      snake.shift
    end

    draw(led, snake, food)

    speed = SPEED_INITIAL - score * SPEED_STEP
    if speed < SPEED_MIN
      speed = SPEED_MIN
    end
    if ate_food
      buzzer.frequency(880)
    end
    elapsed = 0
    while elapsed < speed
      if ate_food && elapsed >= 50
        buzzer.frequency(0)
        ate_food = false
      end
      if btn_up.low?
        if direction != DIR_DOWN
          next_direction = DIR_UP
        end
      elsif btn_down.low?
        if direction != DIR_UP
          next_direction = DIR_DOWN
        end
      elsif btn_left.low?
        if direction != DIR_RIGHT
          next_direction = DIR_LEFT
        end
      elsif btn_right.low?
        if direction != DIR_LEFT
          next_direction = DIR_RIGHT
        end
      end
      sleep_ms 30
      elapsed += 30
    end
    if ate_food
      buzzer.frequency(0)
    end
    direction = next_direction
  end

  game_over_animation(led, buzzer)
  show_score(led, snake, score)
  sleep 3

  led.clear
  while btn_up.high? && btn_down.high? && btn_left.high? && btn_right.high?
    sleep_ms 50
  end
  sleep_ms 200
end
