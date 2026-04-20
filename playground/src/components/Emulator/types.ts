/**
 * Type definitions for Emulator components
 */

import type { WasmRuntimeState } from '../../wasm/types';

export interface LedMatrixProps {
  /** Target pixel values from Ruby (RGB flat array) */
  targetPixels: number[];
  /** Matrix width in LEDs */
  width?: number;
  /** Matrix height in LEDs */
  height?: number;
  /** Whether the matrix is editable (interactive painting) */
  editable?: boolean;
  /** Current paint color [r, g, b] */
  paintColor?: [number, number, number];
  /** Callback when pixels are painted */
  onPixelPaint?: (index: number) => void;
  /** Callback when a paint stroke begins (pointerDown) */
  onStrokeStart?: () => void;
  /** Callback when a paint stroke ends (pointerUp after painting) */
  onStrokeEnd?: () => void;
}

export interface EmulatorPanelProps {
  /** Current runtime state */
  state: WasmRuntimeState;
  /** Target pixels to display */
  targetPixels: number[];
  /** Callback to replace editor content with generated code */
  onReplaceCode?: (code: string) => void;
}
