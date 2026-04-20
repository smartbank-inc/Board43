/** PicoModem — binary file transfer protocol over serial */

// ── Constants ──────────────────────────────────────────────────────────

const STX = 0x02;
const ACK = 0x06;

const FILE_READ = 0x01;
const FILE_WRITE = 0x02;
const DELETE_FILE = 0x06;
const RUN_FILE = 0x07;
const CHUNK = 0x04;
const ABORT = 0xff;

const FILE_DATA = 0x81;
const FILE_ACK = 0x82;
const DELETE_ACK = 0x86;
const RUN_ACK = 0x87;
const CHUNK_ACK = 0x84;
const DONE_ACK = 0x8f;
const ERROR = 0xfe;

const OK = 0x00;
const READY = 0x01;

const CHUNK_SIZE = 512;
const TIMEOUT_MS = 5000;
const TX_CHUNK_SIZE = 32;
const TX_CHUNK_GAP_MS = 20;
const HANDSHAKE_READ_TIMEOUT_MS = 250;

// ── Error ──────────────────────────────────────────────────────────────

export class PicoModemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PicoModemError';
  }
}

// ── CRC helpers ────────────────────────────────────────────────────────

function crc16(data: Uint8Array): number {
  // PicoRuby uses CRC-16/CCITT with an initial value of 0xFFFF.
  let crc = 0xffff;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return crc & 0xffff;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── Frame building ─────────────────────────────────────────────────────

function buildFrame(
  cmd: number,
  payload: Uint8Array = new Uint8Array(),
): Uint8Array {
  const body = new Uint8Array(1 + payload.length);
  body[0] = cmd;
  body.set(payload, 1);
  const crc = crc16(body);
  const frame = new Uint8Array(1 + 2 + body.length + 2);
  frame[0] = STX;
  frame[1] = (body.length >> 8) & 0xff;
  frame[2] = body.length & 0xff;
  frame.set(body, 3);
  frame[3 + body.length] = (crc >> 8) & 0xff;
  frame[3 + body.length + 1] = crc & 0xff;
  return frame;
}

// ── Serial I/O interface ───────────────────────────────────────────────

/** Interface for serial port I/O used by PicoModem. */
export interface SerialIO {
  /** Write raw bytes to serial port, with USB-CDC pacing (32 bytes at a time, 20ms gap). */
  write(data: Uint8Array): Promise<void>;
  /** Read available raw bytes from serial (binary capture buffer). Returns empty array if no data yet. */
  read(maxBytes: number): Promise<Uint8Array>;
  /** Read exactly n bytes, polling with 10ms intervals, with timeout. */
  readExact(n: number, timeoutMs?: number): Promise<Uint8Array>;
}

// ── Helpers ────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeText(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// ── PicoModem ──────────────────────────────────────────────────────────

/** PicoModem binary file transfer over serial. */
export class PicoModem {
  private io: SerialIO;

  constructor(io: SerialIO) {
    this.io = io;
  }

  private decodeError(payload: Uint8Array): string {
    return new TextDecoder().decode(payload);
  }

  private async recvChunkedData(
    dataCmd: number,
    context: string,
  ): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    let receivedSize = 0;
    let first = true;

    while (true) {
      const frame = await this.recvFrame();
      if (!frame) {
        throw new PicoModemError(`Timeout waiting for ${context} frame`);
      }

      if (frame.cmd === ERROR) {
        throw new PicoModemError(
          `Device error: ${this.decodeError(frame.payload)}`,
        );
      }

      if (frame.cmd === DONE_ACK) {
        if (frame.payload.length < 5) {
          throw new PicoModemError('Invalid DONE_ACK payload');
        }
        const status = frame.payload[0];
        if (status !== OK) {
          throw new PicoModemError(
            `${context} failed with status 0x${status.toString(16)}`,
          );
        }
        const expectedCrc =
          ((frame.payload[1] << 24) |
            (frame.payload[2] << 16) |
            (frame.payload[3] << 8) |
            frame.payload[4]) >>>
          0;

        const result = new Uint8Array(receivedSize);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }

        const actualCrc = crc32(result);
        if (actualCrc !== expectedCrc) {
          throw new PicoModemError(
            `CRC-32 mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)}`,
          );
        }
        return result;
      }

      if (frame.cmd === dataCmd) {
        let data: Uint8Array;
        if (first) {
          if (frame.payload.length < 4) {
            throw new PicoModemError(`Invalid first ${context} payload`);
          }
          data = frame.payload.subarray(4);
          first = false;
        } else {
          data = frame.payload;
        }
        chunks.push(data);
        receivedSize += data.length;
        await this.sendFrame(CHUNK_ACK, new Uint8Array([OK]));
        continue;
      }

      throw new PicoModemError(
        `Unexpected command 0x${frame.cmd.toString(16)} during ${context}`,
      );
    }
  }

  /** Send a frame with USB-CDC pacing. */
  private async sendFrame(
    cmd: number,
    payload: Uint8Array = new Uint8Array(),
  ): Promise<void> {
    const frame = buildFrame(cmd, payload);
    for (let offset = 0; offset < frame.length; offset += TX_CHUNK_SIZE) {
      const end = Math.min(offset + TX_CHUNK_SIZE, frame.length);
      await this.io.write(frame.subarray(offset, end));
      if (end < frame.length) {
        await delay(TX_CHUNK_GAP_MS);
      }
    }
  }

  /** Receive a frame, scanning for STX and verifying CRC. */
  private async recvFrame(
    timeoutMs: number = TIMEOUT_MS,
  ): Promise<{ cmd: number; payload: Uint8Array } | null> {
    const deadline = Date.now() + timeoutMs;

    // Scan for STX
    console.log('[PicoModem] recvFrame: scanning for STX...');
    let stxFound = false;
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const byte = await this.io.readExact(1, remaining);
      if (byte[0] === STX) {
        stxFound = true;
        break;
      }
      console.log('[PicoModem] recvFrame: skipping byte', byte[0].toString(16));
    }
    if (!stxFound) {
      console.log('[PicoModem] recvFrame: timeout waiting for STX');
      return null;
    }
    console.log('[PicoModem] recvFrame: STX found, reading frame');

    // Read length (2 bytes big-endian)
    const lenBuf = await this.io.readExact(2, deadline - Date.now());
    const bodyLen = (lenBuf[0] << 8) | lenBuf[1];

    if (bodyLen === 0) {
      throw new PicoModemError('Received frame with zero-length body');
    }

    // Read body + CRC (2 bytes)
    const rest = await this.io.readExact(bodyLen + 2, deadline - Date.now());
    const body = rest.subarray(0, bodyLen);
    const receivedCrc = (rest[bodyLen] << 8) | rest[bodyLen + 1];

    const computed = crc16(body);
    if (computed !== receivedCrc) {
      throw new PicoModemError(
        `CRC-16 mismatch: expected 0x${computed.toString(16)}, got 0x${receivedCrc.toString(16)}`,
      );
    }

    console.log(
      `[PicoModem] recvFrame: cmd=0x${body[0].toString(16)}, payload=${body.length - 1} bytes`,
    );
    return { cmd: body[0], payload: body.subarray(1) };
  }

  /**
   * Download a file from the device.
   *
   * Protocol:
   * 1. Send FILE_READ with path
   * 2. Receive FILE_DATA chunks (first has 4-byte BE total size)
   * 3. ACK each with CHUNK_ACK(OK)
   * 4. Receive DONE_ACK with status + CRC32
   * 5. Verify CRC32
   */
  async readFile(path: string): Promise<Uint8Array> {
    try {
      await this.sendFrame(FILE_READ, encodeText(path));
      return await this.recvChunkedData(FILE_DATA, 'readFile');
    } catch (err) {
      await this.abort();
      throw err;
    }
  }

  /**
   * Upload a file to the device.
   *
   * Protocol:
   * 1. Send FILE_WRITE with 4-byte BE size + path
   * 2. Receive FILE_ACK(READY)
   * 3. Send CHUNK frames (max 512 bytes each)
   * 4. Wait for CHUNK_ACK after each chunk
   * 5. Receive DONE_ACK with status + CRC32
   * 6. Verify CRC32
   */
  async writeFile(path: string, data: Uint8Array): Promise<void> {
    try {
      console.log(`[PicoModem] writeFile: ${path} (${data.length} bytes)`);
      const pathBytes = encodeText(path);
      const header = new Uint8Array(4 + pathBytes.length);
      header[0] = (data.length >> 24) & 0xff;
      header[1] = (data.length >> 16) & 0xff;
      header[2] = (data.length >> 8) & 0xff;
      header[3] = data.length & 0xff;
      header.set(pathBytes, 4);

      await this.sendFrame(FILE_WRITE, header);
      console.log('[PicoModem] FILE_WRITE frame sent, waiting for FILE_ACK');

      // Wait for FILE_ACK(READY)
      const ack = await this.recvFrame();
      if (!ack) {
        throw new PicoModemError('Timeout waiting for FILE_ACK');
      }
      if (ack.cmd === ERROR) {
        throw new PicoModemError(
          `Device error: ${this.decodeError(ack.payload)}`,
        );
      }
      if (ack.cmd !== FILE_ACK || ack.payload[0] !== READY) {
        throw new PicoModemError(
          `Expected FILE_ACK(READY), got cmd=0x${ack.cmd.toString(16)}`,
        );
      }

      // Send chunks
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const end = Math.min(offset + CHUNK_SIZE, data.length);
        const chunk = data.subarray(offset, end);

        await this.sendFrame(CHUNK, chunk);

        const chunkAck = await this.recvFrame();
        if (!chunkAck) {
          throw new PicoModemError('Timeout waiting for CHUNK_ACK');
        }
        if (chunkAck.cmd === ERROR) {
          throw new PicoModemError(
            `Device error: ${this.decodeError(chunkAck.payload)}`,
          );
        }
        if (chunkAck.cmd !== CHUNK_ACK) {
          throw new PicoModemError(
            `Expected CHUNK_ACK, got cmd=0x${chunkAck.cmd.toString(16)}`,
          );
        }
      }

      // Wait for DONE_ACK
      const done = await this.recvFrame();
      if (!done) {
        throw new PicoModemError('Timeout waiting for DONE_ACK');
      }
      if (done.cmd === ERROR) {
        throw new PicoModemError(
          `Device error: ${this.decodeError(done.payload)}`,
        );
      }
      if (done.cmd !== DONE_ACK || done.payload.length < 5) {
        throw new PicoModemError('Invalid DONE_ACK response');
      }

      const status = done.payload[0];
      if (status !== OK) {
        throw new PicoModemError(
          `Transfer failed with status 0x${status.toString(16)}`,
        );
      }

      const expectedCrc =
        ((done.payload[1] << 24) |
          (done.payload[2] << 16) |
          (done.payload[3] << 8) |
          done.payload[4]) >>>
        0;
      const actualCrc = crc32(data);
      if (actualCrc !== expectedCrc) {
        throw new PicoModemError(
          `CRC-32 mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)}`,
        );
      }
    } catch (err) {
      await this.abort();
      throw err;
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      await this.sendFrame(DELETE_FILE, encodeText(path));
      const ack = await this.recvFrame();
      if (!ack) {
        throw new PicoModemError('Timeout waiting for DELETE_ACK');
      }
      if (ack.cmd === ERROR) {
        throw new PicoModemError(
          `Device error: ${this.decodeError(ack.payload)}`,
        );
      }
      if (ack.cmd !== DELETE_ACK || ack.payload[0] !== OK) {
        throw new PicoModemError(
          `Expected DELETE_ACK(OK), got cmd=0x${ack.cmd.toString(16)}`,
        );
      }
    } catch (err) {
      await this.abort();
      throw err;
    }
  }

  async runFile(path: string): Promise<void> {
    try {
      await this.sendFrame(RUN_FILE, encodeText(path));
      const ack = await this.recvFrame();
      if (!ack) {
        throw new PicoModemError('Timeout waiting for RUN_ACK');
      }
      if (ack.cmd === ERROR) {
        throw new PicoModemError(
          `Device error: ${this.decodeError(ack.payload)}`,
        );
      }
      if (ack.cmd !== RUN_ACK || ack.payload[0] !== OK) {
        throw new PicoModemError(
          `Expected RUN_ACK(OK), got cmd=0x${ack.cmd.toString(16)}`,
        );
      }
    } catch (err) {
      await this.abort();
      throw err;
    }
  }

  /** Send ABORT frame (best-effort). */
  async abort(): Promise<void> {
    try {
      await this.sendFrame(ABORT);
    } catch {
      // best-effort
    }
  }
}

// ── Session starter ────────────────────────────────────────────────────

/**
 * Start a PicoModem session:
 * 1. Send Ctrl-B (0x02) to device
 * 2. Wait for ACK (0x06) in the byte stream
 * 3. Return a PicoModem instance ready for one operation
 *
 * The caller must switch the serial read loop to binary capture mode
 * BEFORE calling this, and switch back after the operation completes.
 */
export async function startPicoModemSession(
  io: SerialIO,
  timeoutMs: number = TIMEOUT_MS,
): Promise<PicoModem> {
  console.log('[PicoModem] Sending Ctrl-B to enter session');
  await io.write(new Uint8Array([STX]));

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }
    try {
      const buf = await io.readExact(
        1,
        Math.min(remaining, HANDSHAKE_READ_TIMEOUT_MS),
      );
      console.log('[PicoModem] Received byte:', buf[0].toString(16));
      if (buf[0] === ACK) {
        console.log('[PicoModem] ACK received, waiting for device to be ready');
        await delay(200); // Give device time to enter PicoModem mode
        console.log('[PicoModem] Session started');
        return new PicoModem(io);
      }
    } catch {
      // Keep polling until the session timeout expires.
    }
  }

  throw new PicoModemError(
    'Timeout waiting for ACK from device. Make sure the board is at the shell prompt and running the updated firmware.',
  );
}
