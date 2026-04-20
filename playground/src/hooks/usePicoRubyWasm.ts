/**
 * React hook for managing PicoRuby WASM runtime
 * Provides interface to execute Ruby code in a Web Worker
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WasmRuntimeState,
  WorkerInMessage,
  WorkerOutMessage,
} from '../wasm/types';

export interface UsePicoRubyWasmReturn {
  state: WasmRuntimeState;
  loadRuntime: () => void;
  execute: (code: string) => void;
  stop: () => void;
}

export interface UsePicoRubyWasmOptions {
  onFrame?: (pixels: number[]) => void;
  onOutput?: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

export function usePicoRubyWasm(
  options: UsePicoRubyWasmOptions = {},
): UsePicoRubyWasmReturn {
  const { onFrame, onOutput, onDone, onError } = options;

  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<WasmRuntimeState>({
    loading: false,
    ready: false,
    running: false,
    error: null,
  });

  // Store callbacks in refs to avoid recreating worker message handler
  const callbacksRef = useRef({ onFrame, onOutput, onDone, onError });
  callbacksRef.current = { onFrame, onOutput, onDone, onError };

  // Frame throttling: buffer latest pixels, flush once per RAF
  const pendingFrameRef = useRef<number[] | null>(null);
  const rafIdRef = useRef<number>(0);

  const flushFrame = useCallback(() => {
    rafIdRef.current = 0;
    const pixels = pendingFrameRef.current;
    if (pixels) {
      pendingFrameRef.current = null;
      callbacksRef.current.onFrame?.(pixels);
    }
  }, []);

  const scheduleFrame = useCallback(
    (pixels: number[]) => {
      pendingFrameRef.current = pixels;
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(flushFrame);
      }
    },
    [flushFrame],
  );

  // Create and setup a new worker
  const createWorker = useCallback((): Worker => {
    const worker = new Worker(
      new URL('../workers/picoruby.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'ready':
          setState((prev) => ({ ...prev, loading: false, ready: true }));
          break;

        case 'frame':
          scheduleFrame(message.pixels);
          break;

        case 'output':
          callbacksRef.current.onOutput?.(message.text);
          break;

        case 'done':
          setState((prev) => ({ ...prev, running: false }));
          callbacksRef.current.onDone?.();
          break;

        case 'error':
          setState((prev) => ({
            ...prev,
            loading: false,
            running: false,
            error: message.message,
          }));
          callbacksRef.current.onError?.(message.message);
          break;
      }
    };

    worker.onerror = (error) => {
      setState((prev) => ({
        ...prev,
        loading: false,
        running: false,
        error: error.message,
      }));
      callbacksRef.current.onError?.(error.message);
    };

    return worker;
  }, [scheduleFrame]);

  // Load the runtime (initialize WASM) - creates worker if needed
  const loadRuntime = useCallback(() => {
    if (state.ready || state.loading) return;

    // Create worker if it doesn't exist
    if (!workerRef.current) {
      workerRef.current = createWorker();
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const message: WorkerInMessage = { type: 'init' };
    workerRef.current.postMessage(message);
  }, [state.ready, state.loading, createWorker]);

  // Execute Ruby code - creates fresh worker each time for clean state
  const execute = useCallback(
    (code: string) => {
      // Terminate existing worker and create fresh one for clean VM state
      // This also stops any currently running execution
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      // Create worker with integrated init+execute flow
      const worker = new Worker(
        new URL('../workers/picoruby.worker.ts', import.meta.url),
        { type: 'module' },
      );

      worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        const message = event.data;

        switch (message.type) {
          case 'ready':
            setState((prev) => ({ ...prev, loading: false, ready: true }));
            // Now execute the code
            worker.postMessage({ type: 'execute', code } as WorkerInMessage);
            break;

          case 'frame':
            scheduleFrame(message.pixels);
            break;

          case 'output':
            callbacksRef.current.onOutput?.(message.text);
            break;

          case 'done':
            setState((prev) => ({ ...prev, running: false }));
            callbacksRef.current.onDone?.();
            break;

          case 'error':
            setState((prev) => ({
              ...prev,
              loading: false,
              running: false,
              error: message.message,
            }));
            callbacksRef.current.onError?.(message.message);
            break;
        }
      };

      worker.onerror = (error) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          running: false,
          error: error.message,
        }));
        callbacksRef.current.onError?.(error.message);
      };

      workerRef.current = worker;
      setState({ loading: true, ready: false, running: true, error: null });

      // Start initialization
      worker.postMessage({ type: 'init' } as WorkerInMessage);
    },
    [scheduleFrame],
  );

  // Stop execution by terminating the worker
  const stop = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    pendingFrameRef.current = null;

    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setState((prev) => ({ ...prev, running: false, ready: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return {
    state,
    loadRuntime,
    execute,
    stop,
  };
}
