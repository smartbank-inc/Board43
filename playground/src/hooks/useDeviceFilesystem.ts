import { useCallback, useState } from 'react';
import { PicoModem, type SerialIO } from '../utils/picomodem';

// ── Types ──────────────────────────────────────────────────────────────

export interface UseDeviceFilesystemOptions {
  connected: boolean;
  writeRaw: (data: Uint8Array) => Promise<void>;
  sendRawAndWaitForText: (
    data: Uint8Array,
    expectedText: string,
    timeoutMs?: number,
    suppressOutput?: boolean,
  ) => Promise<string>;
  startBinaryCapture: () => void;
  stopBinaryCapture: () => void;
  suppressNextTerminalLineWithPrefix: (prefix: string) => void;
  binaryRead: (maxBytes: number) => Promise<Uint8Array>;
  binaryReadExact: (n: number, timeoutMs?: number) => Promise<Uint8Array>;
}

export interface UseDeviceFilesystemReturn {
  /** Read a text file from the device */
  readFile: (path: string) => Promise<string>;
  /** Write a text file to the device */
  writeFile: (path: string, content: string) => Promise<void>;
  /** Check if currently performing a file operation */
  busy: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────

const PICOMODEM_EXIT_SETTLE_MS = 300;
const PICOMODEM_INFO_PREFIX = '[PicoModem] ';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPicoModemOp<T>(
  io: SerialIO,
  sendRawAndWaitForText: (
    data: Uint8Array,
    expectedText: string,
    timeoutMs?: number,
    suppressOutput?: boolean,
  ) => Promise<string>,
  startBinaryCapture: () => void,
  stopBinaryCapture: () => void,
  suppressNextTerminalLineWithPrefix: (prefix: string) => void,
  operation: (modem: PicoModem) => Promise<T>,
): Promise<T> {
  suppressNextTerminalLineWithPrefix(PICOMODEM_INFO_PREFIX);
  try {
    console.log('[DeviceFS] Entering PicoModem session');
    await sendRawAndWaitForText(new Uint8Array([0x02]), '\x06', 5000, true);
    console.log('[DeviceFS] Starting binary capture');
    startBinaryCapture();
    await delay(200);
    const modem = new PicoModem(io);
    console.log('[DeviceFS] PicoModem session started');
    const result = await operation(modem);
    console.log('[DeviceFS] Operation completed');
    return result;
  } catch (err) {
    console.error('[DeviceFS] PicoModem operation failed:', err);
    throw err;
  } finally {
    console.log('[DeviceFS] Stopping binary capture');
    stopBinaryCapture();
    await delay(PICOMODEM_EXIT_SETTLE_MS);
  }
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useDeviceFilesystem(
  options: UseDeviceFilesystemOptions,
): UseDeviceFilesystemReturn {
  const [busy, setBusy] = useState(false);

  const readFile = useCallback(
    async (path: string): Promise<string> => {
      if (!options.connected) throw new Error('Not connected');
      setBusy(true);
      try {
        const io: SerialIO = {
          write: options.writeRaw,
          read: options.binaryRead,
          readExact: options.binaryReadExact,
        };
        const data = await runPicoModemOp(
          io,
          options.sendRawAndWaitForText,
          options.startBinaryCapture,
          options.stopBinaryCapture,
          options.suppressNextTerminalLineWithPrefix,
          (modem) => modem.readFile(path),
        );
        return new TextDecoder().decode(data);
      } finally {
        setBusy(false);
      }
    },
    [
      options.connected,
      options.writeRaw,
      options.sendRawAndWaitForText,
      options.startBinaryCapture,
      options.stopBinaryCapture,
      options.suppressNextTerminalLineWithPrefix,
      options.binaryRead,
      options.binaryReadExact,
    ],
  );

  const writeFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      if (!options.connected) throw new Error('Not connected');
      setBusy(true);
      try {
        const io: SerialIO = {
          write: options.writeRaw,
          read: options.binaryRead,
          readExact: options.binaryReadExact,
        };
        const data = new TextEncoder().encode(content);
        await runPicoModemOp(
          io,
          options.sendRawAndWaitForText,
          options.startBinaryCapture,
          options.stopBinaryCapture,
          options.suppressNextTerminalLineWithPrefix,
          (modem) => modem.writeFile(path, data),
        );
      } finally {
        setBusy(false);
      }
    },
    [
      options.connected,
      options.writeRaw,
      options.sendRawAndWaitForText,
      options.startBinaryCapture,
      options.stopBinaryCapture,
      options.suppressNextTerminalLineWithPrefix,
      options.binaryRead,
      options.binaryReadExact,
    ],
  );

  return { readFile, writeFile, busy };
}
