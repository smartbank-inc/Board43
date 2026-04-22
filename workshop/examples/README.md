[English](README_en.md)

# Board43 サンプルコード

## センサーごとのサンプル

| ファイル | 説明 | 使用機能 |
| --- | --- | --- |
| [status_led.rb](status_led.rb) | ステータスLEDのオン・オフ | GPIO |
| [button.rb](button.rb) | ボタンの押下状態を読み取る | スイッチ (GPIO) |
| [buzzer.rb](buzzer.rb) | ブザーを鳴らす・止める | ブザー (PWM) |
| [led_matrix.rb](led_matrix.rb) | LEDマトリクスに虹色グラデーションを表示する | LED (WS2812) |
| [imu.rb](imu.rb) | 加速度・ジャイロ・温度の値をコンソールに表示する | IMU (I2C) |

## 複合サンプル

| ファイル | 説明 | 使用機能 |
| --- | --- | --- |
| [water.rb](water.rb) | ボードを傾けると水が流れる流体シミュレーション | IMU + LED |
| [logo.rb](logo.rb) | RubyKaigi 2026ロゴ表示＋ボタンで背景エフェクト切り替え | スイッチ + LED + ブザー |
| [scroll_two_patterns_right.rb](scroll_two_patterns_right.rb) | 2つの16x16パターンを横につないで右にスクロール表示 | LED |
| [drum.rb](drum.rb) | 4つのボタンで叩くドラム | スイッチ (IRQ) + LED + ブザー |
| [snake_game.rb](snake_game.rb) | ボタンで操作するスネークゲーム | スイッチ + LED + ブザー |
| [theremin.rb](theremin.rb) | ボードを傾けて音階を演奏するテルミン | IMU + LED + ブザー + スイッチ |
