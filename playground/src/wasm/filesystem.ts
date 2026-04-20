/**
 * Ruby code builder for PicoRuby WASM
 *
 * Since PicoRuby WASM doesn't have a virtual filesystem,
 * we concatenate all Ruby code into a single script.
 */

import { createHalApi, createHalImplEmulator } from './halFiles';
import { LED_MATRIX_CONFIG, type LedMatrixConfig } from './types';

export type ExecutionMode = 'device' | 'emulator';

// Device-specific requires that should be stripped for emulator
const DEVICE_REQUIRES = [
  /require\s+["']ws2812["']\s*\n?/g,
  /require\s+["']ws2812-plus["']\s*\n?/g,
  /require\s+["']pio["']\s*\n?/g,
  /require\s+["']gpio["']\s*\n?/g,
  /require\s+["']adc["']\s*\n?/g,
  /require\s+["']i2c["']\s*\n?/g,
  /require\s+["']spi["']\s*\n?/g,
  /require\s+["']uart["']\s*\n?/g,
  /require\s+["']pwm["']\s*\n?/g,
  /require\s+["']qmi8658["']\s*\n?/g,
  /require\s+["']lsm6ds3["']\s*\n?/g,
  /require\s+["']irq["']\s*\n?/g,
  /require_relative\s+["']hal["']\s*\n?/g,
];

export interface BuildScriptOptions {
  /** Execution mode (device or emulator) */
  mode: ExecutionMode;
  /** LED matrix configuration (defaults to LED_MATRIX_CONFIG) */
  ledConfig?: LedMatrixConfig;
}

/**
 * Build the complete Ruby script for execution
 * Concatenates HAL code with user code since require_relative won't work
 * @param userCode - User's Ruby code to execute
 * @param options - Build options including mode and LED config
 * @returns Complete Ruby script ready for execution
 */
export function buildExecutableScript(
  userCode: string,
  options: ExecutionMode | BuildScriptOptions,
): string {
  // Normalize options for backward compatibility
  const opts: BuildScriptOptions =
    typeof options === 'string' ? { mode: options } : options;
  const { mode, ledConfig = LED_MATRIX_CONFIG } = opts;

  if (mode !== 'emulator') {
    // Device mode doesn't use WASM, return code as-is
    return userCode;
  }

  // For emulator mode, we need to:
  // 1. Include the HAL API (class definitions)
  // 2. Include the emulator implementation (JS interop)
  // 3. Strip device-specific requires from user code
  // 4. Add user code

  // Generate HAL code with the configured LED dimensions
  const halApi = createHalApi(ledConfig);
  const halImpl = createHalImplEmulator(ledConfig);

  // Remove device-specific requires
  let cleanedUserCode = userCode;
  for (const pattern of DEVICE_REQUIRES) {
    cleanedUserCode = cleanedUserCode.replace(pattern, '');
  }
  cleanedUserCode = cleanedUserCode.trim();

  return `# HAL API (auto-injected for emulator)
${halApi}

# HAL Emulator Implementation (auto-injected)
${halImpl}

# User Code
${cleanedUserCode}
`;
}
