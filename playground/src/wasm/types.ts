/**
 * Type definitions for PicoRuby WASM integration
 */

/** Message types from main thread to worker */
export type WorkerInMessage =
  | { type: 'init' }
  | { type: 'execute'; code: string }
  | { type: 'stop' };

/** Message types from worker to main thread */
export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'frame'; pixels: number[] }
  | { type: 'output'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** State of the WASM runtime */
export interface WasmRuntimeState {
  loading: boolean;
  ready: boolean;
  running: boolean;
  error: string | null;
}

/**
 * LED matrix dimensions
 * Change these values to support different matrix sizes.
 */
export const LED_MATRIX_WIDTH = 16;
export const LED_MATRIX_HEIGHT = 16;
export const LED_COUNT = LED_MATRIX_WIDTH * LED_MATRIX_HEIGHT;

/** LED matrix configuration for use in HAL code generation */
export interface LedMatrixConfig {
  width: number;
  height: number;
  count: number;
}

export const LED_MATRIX_CONFIG: LedMatrixConfig = {
  width: LED_MATRIX_WIDTH,
  height: LED_MATRIX_HEIGHT,
  count: LED_COUNT,
};
