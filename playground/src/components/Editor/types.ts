export interface EditorFile {
  id: string;
  name: string;
  content: string;
}

export interface EditorState {
  files: EditorFile[];
  activeFileId: string | null;
  openFileIds: string[];
}

export interface DeviceFilesystem {
  /** Returns raw shell stdout of a directory listing (e.g. `ls /home`). */
  listRaw: () => Promise<string>;
  /** Reads a text file from the device at the given absolute path. */
  readFile: (path: string) => Promise<string>;
}
