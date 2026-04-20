/**
 * Web Worker for PicoRuby WASM execution
 * Runs Ruby code in an isolated thread to prevent blocking the UI
 */

// Polyfill browser globals that PicoRuby WASM expects
// Workers don't have 'window' or 'document', but the WASM module checks for them
const globalScope = self as unknown as Record<string, unknown>;
if (typeof globalScope.window === 'undefined') {
  globalScope.window = self;
}
if (typeof globalScope.document === 'undefined') {
  // Minimal document stub - PicoRuby uses document.querySelectorAll for script tags
  globalScope.document = {
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({}),
    currentScript: null,
  };
}

import { buildExecutableScript } from '../wasm/filesystem';
import type { WorkerInMessage, WorkerOutMessage } from '../wasm/types';

// Type definitions for the PicoRuby WASM module
interface PicoRubyModule {
  ccall: (
    name: string,
    returnType: string | null,
    argTypes: string[],
    args: unknown[],
    options?: { async?: boolean },
  ) => unknown;
}

// PicoRuby WASM module instance
let Module: PicoRubyModule | null = null;
let isRunning = false;
let stopRequested = false;

// Post message helper with type safety
function postMessage(message: WorkerOutMessage): void {
  self.postMessage(message);
}

// Set up global functions that Ruby code can call via JS interop
function setupGlobalBridge(): void {
  const globalScope = self as unknown as Record<string, unknown>;

  // Ruby calls JS.global.setPixelData(json_string)
  // The VM runs the entire Ruby loop inside a single mrbc_run_step call,
  // so we must block here to throttle frame rate (~30fps).
  // Busy-wait is acceptable in a Web Worker — stop uses worker.terminate().
  const TARGET_FRAME_MS = 33;
  let lastFrameTime = 0;
  globalScope.setPixelData = (jsonData: string): void => {
    if (typeof jsonData === 'string' && jsonData.length > 0) {
      // Busy-wait until enough time has passed since last frame
      const earliest = lastFrameTime + TARGET_FRAME_MS;
      while (performance.now() < earliest) {
        /* spin */
      }
      lastFrameTime = performance.now();

      try {
        const parsed = JSON.parse(jsonData);
        if (Array.isArray(parsed)) {
          postMessage({ type: 'frame', pixels: parsed.map(Number) });
        }
      } catch (e) {
        console.error('[worker] JSON parse error:', e);
      }
    }
  };
}

// Initialize the PicoRuby WASM module
async function initModule(): Promise<void> {
  if (Module) return;

  try {
    // Dynamic import of the PicoRuby module
    // Vite will handle bundling this correctly
    const picorubyModule = await import('@picoruby/wasm-wasi/picoruby.js');
    const createModule = picorubyModule.default;

    Module = (await createModule()) as PicoRubyModule;

    // Initialize the Ruby VM
    Module.ccall('picorb_init', 'number', [], []);

    setupGlobalBridge();
    postMessage({ type: 'ready' });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to initialize PicoRuby WASM';
    postMessage({ type: 'error', message });
  }
}

// Run the PicoRuby VM step loop
function runStepLoop(): void {
  if (!Module || !isRunning || stopRequested) {
    isRunning = false;
    stopRequested = false;
    postMessage({ type: 'done' });
    return;
  }

  const MRBC_TICK_UNIT = 8.1;
  let lastTime = performance.now();

  function step(): void {
    if (!Module || stopRequested) {
      isRunning = false;
      stopRequested = false;
      postMessage({ type: 'done' });
      return;
    }

    const now = performance.now();
    if (MRBC_TICK_UNIT <= now - lastTime) {
      Module.ccall('mrbc_tick', null, [], []);
      lastTime = now;
    }

    const result = Module.ccall('mrbc_run_step', 'number', [], [], {
      async: true,
    }) as number;

    if (result < 0) {
      // result < 0 means all tasks are dormant or finished.
      // Dormant tasks (e.g. sleeping) will wake up after enough ticks,
      // so keep the loop alive and retry after a short delay.
      setTimeout(step, 50);
      return;
    }

    // Continue running
    setTimeout(step, 0);
  }

  step();
}

// Execute Ruby code
function executeCode(code: string): void {
  if (!Module) {
    postMessage({ type: 'error', message: 'PicoRuby WASM not initialized' });
    return;
  }

  if (isRunning) {
    postMessage({ type: 'error', message: 'Already running' });
    return;
  }

  try {
    isRunning = true;
    stopRequested = false;

    // Build complete script with HAL code inlined
    const script = buildExecutableScript(code, 'emulator');

    // Create and run the task
    Module.ccall('picorb_create_task', 'number', ['string'], [script]);

    // Start the step loop
    runStepLoop();
  } catch (error) {
    isRunning = false;
    const message = error instanceof Error ? error.message : 'Execution failed';
    postMessage({ type: 'error', message });
  }
}

// Handle incoming messages
self.onmessage = async (
  event: MessageEvent<WorkerInMessage>,
): Promise<void> => {
  const message = event.data;

  switch (message.type) {
    case 'init':
      await initModule();
      break;

    case 'execute':
      if (!Module) {
        await initModule();
      }
      executeCode(message.code);
      break;

    case 'stop':
      stopRequested = true;
      break;
  }
};
