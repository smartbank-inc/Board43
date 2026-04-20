declare global {
  interface Window {
    showDirectoryPicker(options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?:
        | 'desktop'
        | 'documents'
        | 'downloads'
        | 'music'
        | 'pictures'
        | 'videos';
    }): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
    queryPermission(options?: {
      mode?: 'read' | 'readwrite';
    }): Promise<PermissionState>;
    requestPermission(options?: {
      mode?: 'read' | 'readwrite';
    }): Promise<PermissionState>;
  }
}

const DB_NAME = 'board43playground';
const STORE_NAME = 'filesystem';
const HANDLE_KEY = 'directoryHandle';

let directoryHandle: FileSystemDirectoryHandle | null = null;

// IndexedDB helpers
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
  });
}

async function saveHandleToDB(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getHandleFromDB(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export interface SavedDirectory {
  name: string;
  handle: FileSystemDirectoryHandle;
}

export async function getSavedDirectory(): Promise<SavedDirectory | null> {
  const handle = await getHandleFromDB();
  if (!handle) return null;
  return { name: handle.name, handle };
}

export async function useSavedDirectory(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  try {
    // Check if we have permission
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission === 'prompt') {
      permission = await handle.requestPermission({ mode: 'readwrite' });
    }
    if (permission !== 'granted') return false;

    directoryHandle = handle;
    return true;
  } catch {
    return false;
  }
}

export async function selectTargetDirectory(): Promise<boolean> {
  try {
    directoryHandle = await window.showDirectoryPicker({
      id: 'r2p2-home',
      mode: 'readwrite',
    });
    // Save to IndexedDB for next time
    await saveHandleToDB(directoryHandle);
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return false;
    throw err;
  }
}

export const hasDirectoryAccess = () => directoryHandle !== null;
export const clearDirectoryAccess = () => {
  directoryHandle = null;
};
export const getDirectoryName = () => directoryHandle?.name ?? null;

// Binary file extensions to exclude
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.webp',
  '.svg',
  '.bin',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
]);

export function isTextFile(filename: string): boolean {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  return !BINARY_EXTENSIONS.has(ext);
}

export interface FileEntry {
  name: string;
  content: string;
}

export async function listFiles(): Promise<FileEntry[]> {
  if (!directoryHandle) {
    throw new Error(
      'No directory selected. Please select the target folder first.',
    );
  }

  const files: FileEntry[] = [];

  for await (const entry of directoryHandle.values()) {
    if (
      entry.kind === 'file' &&
      isTextFile(entry.name) &&
      !entry.name.startsWith('.')
    ) {
      try {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const content = await file.text();
        files.push({ name: entry.name, content });
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readFile(filename: string): Promise<string> {
  if (!directoryHandle) {
    throw new Error(
      'No directory selected. Please select the target folder first.',
    );
  }

  const fileHandle = await directoryHandle.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return file.text();
}

export async function writeFileText(
  filename: string,
  content: string,
): Promise<void> {
  if (!directoryHandle) {
    throw new Error(
      'No directory selected. Please select the target folder first.',
    );
  }
  const basename = filename.split('/').pop() || filename;
  const fileHandle = await directoryHandle.getFileHandle(basename, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function writeFile(
  filename: string,
  content: ArrayBuffer | Uint8Array,
): Promise<void> {
  if (!directoryHandle) {
    throw new Error(
      'No directory selected. Please select the target folder first.',
    );
  }
  const basename = filename.split('/').pop() || filename;
  const fileHandle = await directoryHandle.getFileHandle(basename, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  const data =
    content instanceof ArrayBuffer
      ? content
      : (content.buffer.slice(
          content.byteOffset,
          content.byteOffset + content.byteLength,
        ) as ArrayBuffer);
  await writable.write(data);
  await writable.close();

  // Remove macOS AppleDouble resource fork file
  try {
    await directoryHandle.removeEntry(`._${basename}`);
  } catch {
    /* doesn't exist or can't remove */
  }
}

export async function deleteFileFromDirectory(filename: string): Promise<void> {
  if (!directoryHandle) {
    throw new Error(
      'No directory selected. Please select the target folder first.',
    );
  }
  const basename = filename.split('/').pop() || filename;
  await directoryHandle.removeEntry(basename);

  // Also remove macOS AppleDouble resource fork file if exists
  try {
    await directoryHandle.removeEntry(`._${basename}`);
  } catch {
    /* doesn't exist or can't remove */
  }
}

export async function createFileInDirectory(
  filename: string,
  content: string,
): Promise<void> {
  if (!directoryHandle) {
    throw new Error(
      'No directory selected. Please select the target folder first.',
    );
  }
  const basename = filename.split('/').pop() || filename;
  const fileHandle = await directoryHandle.getFileHandle(basename, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
