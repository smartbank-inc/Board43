import type { Terminal } from 'ghostty-web';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocalizedMessage } from '../i18n';

const MAX_TERMINAL_BUFFER_CHARS = 20000;
// biome-ignore lint/suspicious/noControlCharactersInRegex: ESC byte is required to match ANSI escape sequences
const ANSI_ESCAPE_PATTERN = /\u001b(?:\[[0-?]*[ -/]*[@-~]|[@-Z\\-_])/g;
const SHELL_PROMPT = '$> ';
const SHELL_PROMPT_TIMEOUT_MS = 5000;

function normalizeTerminalText(text: string): string {
  return text
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function extractCompletedShellCommandOutput(
  normalizedText: string,
  command: string,
): string | null {
  // The shell's line editor redraws the current line on every keystroke
  // using cursor escapes, so after ANSI stripping the capture looks like:
  //   $> l$> ls$> ls $> ls /home\n<output>\n$>
  // (with a trailing space after the final `$>`). We find the last
  // occurrence of `${command}\n` and take everything up to the trailing
  // `$> ` as stdout.
  const cmdWithNl = `${command}\n`;
  const cmdIndex = normalizedText.lastIndexOf(cmdWithNl);
  if (cmdIndex < 0) return null;

  const afterCmd = normalizedText.slice(cmdIndex + cmdWithNl.length);
  if (!afterCmd.endsWith(SHELL_PROMPT)) return null;

  return afterCmd
    .slice(0, afterCmd.length - SHELL_PROMPT.length)
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

function hasShellPrompt(text: string): boolean {
  return normalizeTerminalText(text).includes(SHELL_PROMPT);
}

interface SerialConnectionEvent extends Event {
  port: SerialPort;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: LocalizedMessage;
  details?: LocalizedMessage;
}

export function useSerial(terminalRef: React.RefObject<Terminal | null>) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] =
    useState<LocalizedMessage | null>(null);
  const [unexpectedDisconnect, setUnexpectedDisconnect] = useState(false);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null,
  );
  const readLoopActiveRef = useRef(false);
  const readLoopPromiseRef = useRef<Promise<void> | null>(null);
  const outputBufferRef = useRef('');
  const captureCallbackRef = useRef<((text: string) => void) | null>(null);
  const suppressTerminalOutputRef = useRef(false);
  const binaryCaptureActiveRef = useRef(false);
  const binaryCaptureBufferRef = useRef<Uint8Array[]>([]);
  const binaryCaptureResolversRef = useRef<Array<(data: Uint8Array) => void>>(
    [],
  );
  const suppressedLinePrefixesRef = useRef<string[]>([]);
  const suppressedTextBufferRef = useRef('');
  const intentionalDisconnectRef = useRef(false);
  const disconnectCleanupRef = useRef(false);

  const resetTransientSerialState = useCallback(() => {
    captureCallbackRef.current = null;
    suppressTerminalOutputRef.current = false;
    binaryCaptureActiveRef.current = false;
    binaryCaptureBufferRef.current = [];
    for (const resolve of binaryCaptureResolversRef.current) {
      resolve(new Uint8Array(0));
    }
    binaryCaptureResolversRef.current = [];
    suppressedLinePrefixesRef.current = [];
    suppressedTextBufferRef.current = '';
  }, []);

  const appendToTerminalBuffer = useCallback((text: string) => {
    if (!text) return;
    outputBufferRef.current += text;
    if (outputBufferRef.current.length > MAX_TERMINAL_BUFFER_CHARS) {
      outputBufferRef.current = outputBufferRef.current.slice(
        -MAX_TERMINAL_BUFFER_CHARS,
      );
    }
  }, []);

  const clearTerminalBuffer = useCallback(() => {
    outputBufferRef.current = '';
  }, []);

  const handleIncomingText = useCallback(
    (text: string) => {
      if (!text) return;
      captureCallbackRef.current?.(text);
      if (suppressTerminalOutputRef.current) {
        return;
      }
      appendToTerminalBuffer(text);
      terminalRef.current?.write(text);
    },
    [appendToTerminalBuffer, terminalRef],
  );

  const filterTerminalText = useCallback(
    (text: string, flush = false): string => {
      if (!text && !flush) return '';

      let pending = suppressedTextBufferRef.current + text;
      suppressedTextBufferRef.current = '';

      if (suppressedLinePrefixesRef.current.length === 0) {
        return pending;
      }

      let output = '';
      while (pending.length > 0) {
        const prefix = suppressedLinePrefixesRef.current[0];
        if (!prefix) {
          output += pending;
          break;
        }

        const newlineIndex = pending.search(/[\r\n]/);
        if (newlineIndex < 0) {
          if (!flush && prefix.startsWith(pending)) {
            suppressedTextBufferRef.current = pending;
            return output;
          }
          if (pending.startsWith(prefix)) {
            if (flush) {
              suppressedLinePrefixesRef.current.shift();
            } else {
              suppressedTextBufferRef.current = pending;
              return output;
            }
          } else {
            output += pending;
          }
          break;
        }

        const newlineLength =
          pending[newlineIndex] === '\r' && pending[newlineIndex + 1] === '\n'
            ? 2
            : 1;
        const line = pending.slice(0, newlineIndex);
        const lineWithEnding = pending.slice(0, newlineIndex + newlineLength);
        pending = pending.slice(newlineIndex + newlineLength);

        if (line.startsWith(prefix)) {
          suppressedLinePrefixesRef.current.shift();
          continue;
        }

        output += lineWithEnding;
      }

      return output;
    },
    [],
  );

  const suppressNextTerminalLineWithPrefix = useCallback((prefix: string) => {
    suppressedLinePrefixesRef.current.push(prefix);
  }, []);

  const handleUnexpectedDisconnect = useCallback(async () => {
    if (intentionalDisconnectRef.current || disconnectCleanupRef.current) {
      return;
    }
    disconnectCleanupRef.current = true;
    try {
      readLoopActiveRef.current = false;

      const reader = readerRef.current;
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
        readerRef.current = null;
      }

      readLoopPromiseRef.current = null;

      const port = portRef.current;
      if (port) {
        try {
          await port.close();
        } catch {
          /* ignore */
        }
      }
      portRef.current = null;

      setConnected(false);
      setError(null);
      setConnectionError({ key: 'status.deviceDisconnected' });
      setUnexpectedDisconnect(true);
    } finally {
      disconnectCleanupRef.current = false;
    }
  }, []);

  const startReadLoop = useCallback(async () => {
    const port = portRef.current;
    if (!port?.readable || readLoopActiveRef.current) return;

    readLoopActiveRef.current = true;
    const reader = port.readable.getReader();
    readerRef.current = reader;
    const decoder = new TextDecoder();

    readLoopPromiseRef.current = (async () => {
      let unexpectedEnd = false;
      try {
        while (readLoopActiveRef.current) {
          const { value, done } = await reader.read();
          if (done) {
            unexpectedEnd = true;
            break;
          }
          if (value) {
            // Binary capture mode: divert to binary buffer, skip terminal
            if (binaryCaptureActiveRef.current) {
              binaryCaptureBufferRef.current.push(new Uint8Array(value));
              const resolvers = binaryCaptureResolversRef.current;
              binaryCaptureResolversRef.current = [];
              for (const resolve of resolvers) {
                resolve(new Uint8Array(0));
              }
              continue;
            }
            const text = filterTerminalText(
              decoder.decode(value, { stream: true }),
            );
            if (!text) {
              continue;
            }
            handleIncomingText(text);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Read error:', err);
          unexpectedEnd = true;
        }
      } finally {
        const remaining = filterTerminalText(decoder.decode(), true);
        if (remaining) {
          handleIncomingText(remaining);
        }
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
        readerRef.current = null;
        readLoopPromiseRef.current = null;
        if (
          unexpectedEnd &&
          readLoopActiveRef.current &&
          portRef.current === port
        ) {
          void handleUnexpectedDisconnect();
        }
      }
    })();
  }, [filterTerminalText, handleIncomingText, handleUnexpectedDisconnect]);

  const stopReadLoop = useCallback(async () => {
    readLoopActiveRef.current = false;
    const reader = readerRef.current;
    const loopPromise = readLoopPromiseRef.current;

    if (reader) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
      readerRef.current = null;
    }

    if (loopPromise) {
      try {
        await Promise.race([
          loopPromise,
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
      } catch {
        /* ignore */
      }
      readLoopPromiseRef.current = null;
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: terminalRef is a stable ref
  const connect = useCallback(
    async (
      baudRate = 115200,
      existingPort?: SerialPort,
    ): Promise<ConnectionTestResult> => {
      try {
        intentionalDisconnectRef.current = false;
        setError(null);
        setConnectionError(null);

        if (!('serial' in navigator)) {
          const error: LocalizedMessage = {
            key: 'wizard.error.noSerialSupport',
          };
          setConnectionError(error);
          return {
            success: false,
            error,
            details: { key: 'wizard.error.noSerialSupport.details' },
          };
        }

        // Close any existing port first
        if (portRef.current) {
          await stopReadLoop();
          try {
            await portRef.current.setSignals({
              dataTerminalReady: false,
              requestToSend: false,
            });
          } catch {
            /* ignore */
          }
          try {
            await portRef.current.close();
          } catch {
            /* ignore */
          }
          portRef.current = null;
        }

        // Reset state before connecting
        readLoopActiveRef.current = false;
        readerRef.current = null;
        readLoopPromiseRef.current = null;
        resetTransientSerialState();

        const grantedPorts = await navigator.serial.getPorts();
        let candidatePorts: SerialPort[];

        if (existingPort) {
          candidatePorts = [
            existingPort,
            ...grantedPorts.filter((port) => port !== existingPort),
          ];
        } else if (grantedPorts.length > 0) {
          candidatePorts = grantedPorts;
        } else {
          let requestedPort: SerialPort;
          try {
            requestedPort = await navigator.serial.requestPort();
          } catch (err) {
            if (err instanceof Error && err.name === 'NotFoundError') {
              const error: LocalizedMessage = {
                key: 'wizard.error.noPortSelected',
              };
              setConnectionError(error);
              return {
                success: false,
                error,
                details: { key: 'wizard.error.noPortSelected.details' },
              };
            }
            throw err;
          }
          const refreshedPorts = await navigator.serial.getPorts();
          candidatePorts = [
            requestedPort,
            ...refreshedPorts.filter((port) => port !== requestedPort),
          ];
        }

        const closeCurrentPort = async () => {
          await stopReadLoop();
          const currentPort = portRef.current;
          if (!currentPort) {
            return;
          }
          try {
            await currentPort.setSignals({
              dataTerminalReady: false,
              requestToSend: false,
            });
          } catch {
            /* ignore */
          }
          try {
            await currentPort.close();
          } catch {
            /* ignore */
          }
          portRef.current = null;
          readLoopActiveRef.current = false;
          readerRef.current = null;
          readLoopPromiseRef.current = null;
          resetTransientSerialState();
        };

        const probeShellPrompt = async (): Promise<boolean> => {
          if (hasShellPrompt(outputBufferRef.current)) {
            return true;
          }

          return new Promise<boolean>((resolve) => {
            let settled = false;
            let captured = outputBufferRef.current;
            const previousCapture = captureCallbackRef.current;

            const cleanup = () => {
              captureCallbackRef.current = previousCapture;
              window.clearTimeout(timeoutTimer);
            };

            const finish = (result: boolean) => {
              if (settled) return;
              settled = true;
              cleanup();
              resolve(result);
            };

            captureCallbackRef.current = (text: string) => {
              previousCapture?.(text);
              captured += text;
              if (hasShellPrompt(captured)) {
                finish(true);
              }
            };

            const timeoutTimer = window.setTimeout(() => {
              finish(false);
            }, SHELL_PROMPT_TIMEOUT_MS);

            const sendProbeBytes = async (bytes: Uint8Array) => {
              const currentPort = portRef.current;
              if (!currentPort?.writable) {
                return;
              }
              const writer = currentPort.writable.getWriter();
              try {
                await writer.write(bytes);
              } finally {
                writer.releaseLock();
              }
            };

            void (async () => {
              try {
                // Don't send Ctrl+C — it can kill the boot process.
                // Just send Enter periodically to elicit the shell prompt.
                for (let i = 0; i < 10 && !settled; i++) {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  if (settled) break;
                  await sendProbeBytes(new Uint8Array([0x0d]));
                }
              } catch {
                finish(false);
              }
            })();
          });
        };

        for (const port of candidatePorts) {
          terminalRef.current?.clear();
          clearTerminalBuffer();
          resetTransientSerialState();

          try {
            await port.open({ baudRate, bufferSize: 8192 });
          } catch (err) {
            if (
              err instanceof Error &&
              (err.name === 'InvalidStateError' || err.name === 'NetworkError')
            ) {
              continue;
            }
            throw err;
          }

          portRef.current = port;

          try {
            await port.setSignals({
              dataTerminalReady: true,
              requestToSend: true,
            });
          } catch {
            await closeCurrentPort();
            continue;
          }

          if (!port.writable || !port.readable) {
            await closeCurrentPort();
            continue;
          }

          await startReadLoop();
          const promptReady = await probeShellPrompt();
          if (!promptReady) {
            await closeCurrentPort();
            continue;
          }

          setConnected(true);
          setConnectionError(null);

          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 100);

          return { success: true };
        }

        const error: LocalizedMessage = { key: 'wizard.error.noShellPort' };
        setConnectionError(error);
        setConnected(false);
        return {
          success: false,
          error,
          details: { key: 'wizard.error.noShellPort.details' },
        };
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : null;
        const error: LocalizedMessage = rawMessage
          ? { text: rawMessage }
          : { key: 'wizard.error.connectionFailed' };
        setError(rawMessage ?? 'Connection failed');
        setConnectionError(error);
        setConnected(false);
        return {
          success: false,
          error,
          details: { key: 'wizard.error.unexpected.details' },
        };
      }
    },
    [
      startReadLoop,
      stopReadLoop,
      clearTerminalBuffer,
      resetTransientSerialState,
    ],
  );

  const disconnect = useCallback(async () => {
    const port = portRef.current;
    try {
      intentionalDisconnectRef.current = true;
      // Send Ctrl+C to interrupt any running script before disconnecting
      if (port?.writable) {
        try {
          const writer = port.writable.getWriter();
          await writer.write(new Uint8Array([0x03])); // Ctrl+C
          writer.releaseLock();
          await new Promise((r) => setTimeout(r, 100));
        } catch {
          /* ignore */
        }
      }

      // Stop the read loop
      await stopReadLoop();

      if (port) {
        // Drop DTR/RTS signals (like picocom Ctrl+A Ctrl+X)
        try {
          await port.setSignals({
            dataTerminalReady: false,
            requestToSend: false,
          });
        } catch {
          /* ignore */
        }
        // Close the port
        try {
          await port.close();
        } catch {
          /* ignore */
        }
      }
      portRef.current = null;
    } finally {
      setConnected(false);
      setError(null);
      setConnectionError(null);
      intentionalDisconnectRef.current = false;
      resetTransientSerialState();
    }
  }, [resetTransientSerialState, stopReadLoop]);

  const write = useCallback(async (data: string) => {
    if (!portRef.current?.writable) return false;
    const writer = portRef.current.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(data));
      return true;
    } finally {
      writer.releaseLock();
    }
  }, []);

  const startBinaryCapture = useCallback(() => {
    binaryCaptureActiveRef.current = true;
    binaryCaptureBufferRef.current = [];
    binaryCaptureResolversRef.current = [];
  }, []);

  const stopBinaryCapture = useCallback(() => {
    binaryCaptureActiveRef.current = false;
    binaryCaptureBufferRef.current = [];
    for (const resolve of binaryCaptureResolversRef.current) {
      resolve(new Uint8Array(0));
    }
    binaryCaptureResolversRef.current = [];
  }, []);

  /**
   * Read up to maxBytes from binary capture buffer.
   * Returns immediately with available data, or waits for new data if buffer is empty.
   */
  const binaryRead = useCallback(
    async (maxBytes: number): Promise<Uint8Array> => {
      const chunks = binaryCaptureBufferRef.current;
      if (chunks.length > 0) {
        let totalLen = 0;
        for (const c of chunks) totalLen += c.length;
        const available = Math.min(totalLen, maxBytes);
        const result = new Uint8Array(available);
        let offset = 0;
        while (offset < available && chunks.length > 0) {
          const chunk = chunks[0];
          const take = Math.min(chunk.length, available - offset);
          result.set(chunk.subarray(0, take), offset);
          offset += take;
          if (take < chunk.length) {
            chunks[0] = chunk.subarray(take);
          } else {
            chunks.shift();
          }
        }
        return result;
      }

      return new Promise<Uint8Array>((resolve) => {
        binaryCaptureResolversRef.current.push(() => {
          resolve(new Uint8Array(0));
        });
      });
    },
    [],
  );

  /**
   * Read exactly n bytes from binary capture, polling until available or timeout.
   */
  const binaryReadExact = useCallback(
    async (n: number, timeoutMs = 5000): Promise<Uint8Array> => {
      const result = new Uint8Array(n);
      let filled = 0;
      const deadline = Date.now() + timeoutMs;

      while (filled < n) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          throw new Error(`Binary read timeout (got ${filled}/${n} bytes)`);
        }
        // Race binaryRead against a timeout to prevent hanging
        const chunk = await Promise.race([
          binaryRead(n - filled),
          new Promise<Uint8Array>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(`Binary read timeout (got ${filled}/${n} bytes)`),
                ),
              remaining,
            ),
          ),
        ]);
        if (chunk.length > 0) {
          result.set(chunk, filled);
          filled += chunk.length;
        } else {
          await new Promise((r) => setTimeout(r, 10));
        }
      }
      return result;
    },
    [binaryRead],
  );

  /**
   * Write raw bytes to serial port with USB-CDC pacing.
   * Sends in 32-byte chunks with 20ms gaps.
   */
  const writeRaw = useCallback(async (data: Uint8Array): Promise<void> => {
    if (!portRef.current?.writable) {
      throw new Error('Serial port not connected');
    }
    const TX_CHUNK = 32;
    const TX_GAP = 20;
    let offset = 0;
    while (offset < data.length) {
      const end = Math.min(offset + TX_CHUNK, data.length);
      const chunk = data.subarray(offset, end);
      const writer = portRef.current.writable.getWriter();
      try {
        await writer.write(chunk);
      } finally {
        writer.releaseLock();
      }
      offset = end;
      if (offset < data.length) {
        await new Promise((r) => setTimeout(r, TX_GAP));
      }
    }
  }, []);

  const waitForCapturedText = useCallback(
    async (
      expectedText: string,
      timeoutMs = 5000,
      suppressOutput = false,
    ): Promise<string> => {
      if (captureCallbackRef.current) {
        throw new Error('Another serial capture is already active');
      }

      return new Promise<string>((resolve, reject) => {
        let captured = '';
        let settled = false;
        const previousSuppress = suppressTerminalOutputRef.current;

        const cleanup = () => {
          captureCallbackRef.current = null;
          suppressTerminalOutputRef.current = previousSuppress;
          window.clearTimeout(timeoutTimer);
        };

        const timeoutTimer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(
            new Error(
              `Timed out waiting for serial text ${JSON.stringify(expectedText)}`,
            ),
          );
        }, timeoutMs);

        suppressTerminalOutputRef.current = suppressOutput || previousSuppress;

        captureCallbackRef.current = (text: string) => {
          captured += text;
          if (!captured.includes(expectedText)) {
            return;
          }
          if (settled) return;
          settled = true;
          cleanup();
          resolve(captured);
        };
      });
    },
    [],
  );

  const sendRawAndWaitForText = useCallback(
    async (
      data: Uint8Array,
      expectedText: string,
      timeoutMs = 5000,
      suppressOutput = false,
    ): Promise<string> => {
      const waitPromise = waitForCapturedText(
        expectedText,
        timeoutMs,
        suppressOutput,
      );
      await writeRaw(data);
      return waitPromise;
    },
    [waitForCapturedText, writeRaw],
  );

  const sendCommand = useCallback(
    async (command: string, timeoutMs = 5000): Promise<string> => {
      if (!portRef.current?.writable) {
        throw new Error('Serial port not connected');
      }

      return new Promise<string>((resolve, reject) => {
        let captured = '';
        let settled = false;

        const cleanup = () => {
          captureCallbackRef.current = null;
          suppressTerminalOutputRef.current = false;
          window.clearTimeout(timeoutTimer);
        };

        const timeoutTimer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          console.error('[Serial] Command timeout', {
            command,
            capturedRaw: captured,
            capturedNormalized: normalizeTerminalText(captured),
          });
          cleanup();
          reject(new Error('Command timeout'));
        }, timeoutMs);

        captureCallbackRef.current = (text: string) => {
          captured += text;
          // The PicoRuby shell line editor calls IO.get_cursor_position on
          // every keystroke, which prints `\e[6n` (DSR) and blocks up to
          // 500ms waiting for a reply. Normally ghostty-web answers on the
          // user's behalf via onData, but we're suppressing terminal output
          // here, so we answer the DSR ourselves with a fake cursor position.
          if (text.includes('\u001b[6n')) {
            void write('\u001b[24;80R').catch(() => {
              // ignore — timeout path will surface any real failure
            });
          }
          const output = extractCompletedShellCommandOutput(
            normalizeTerminalText(captured),
            command,
          );
          if (output === null) {
            return;
          }

          if (settled) return;
          settled = true;
          cleanup();
          resolve(output);
        };
        suppressTerminalOutputRef.current = true;

        void write(`${command}\r`).then(
          (ok) => {
            if (!ok && !settled) {
              settled = true;
              cleanup();
              reject(new Error('Failed to send command'));
            }
          },
          (err) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(
              err instanceof Error ? err : new Error('Failed to send command'),
            );
          },
        );
      });
    },
    [write],
  );

  const clearConnectionError = useCallback(() => {
    setConnectionError(null);
    setUnexpectedDisconnect(false);
  }, []);

  // Listen for global serial disconnect events
  useEffect(() => {
    if (!('serial' in navigator)) return;

    const handleDisconnect = (event: Event) => {
      const serialEvent = event as SerialConnectionEvent;
      if (serialEvent.port && serialEvent.port === portRef.current) {
        void handleUnexpectedDisconnect();
      }
    };

    navigator.serial.addEventListener('disconnect', handleDisconnect);
    return () => {
      navigator.serial.removeEventListener('disconnect', handleDisconnect);
    };
  }, [handleUnexpectedDisconnect]);

  // Listen for port disconnect events (some browsers).
  // `connected` is in the dep list so the effect re-runs after a successful
  // connect, when `portRef.current` is finally populated.
  // biome-ignore lint/correctness/useExhaustiveDependencies: portRef.current is read inside, `connected` triggers re-run
  useEffect(() => {
    const handleDisconnect = async () => {
      await handleUnexpectedDisconnect();
    };

    const port = portRef.current;
    if (port) {
      port.addEventListener('disconnect', handleDisconnect);
      return () => {
        port.removeEventListener('disconnect', handleDisconnect);
      };
    }
  }, [connected, handleUnexpectedDisconnect]);

  return {
    connected,
    error,
    connectionError,
    unexpectedDisconnect,
    connect,
    disconnect,
    write,
    sendCommand,
    sendRawAndWaitForText,
    writeRaw,
    startBinaryCapture,
    stopBinaryCapture,
    suppressNextTerminalLineWithPrefix,
    binaryRead,
    binaryReadExact,
    clearConnectionError,
    startReadLoop,
    getTerminalBuffer: () => outputBufferRef.current,
    clearTerminalBuffer,
  };
}
