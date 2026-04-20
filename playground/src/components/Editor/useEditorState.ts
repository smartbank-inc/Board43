import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorFile, EditorState } from './types';

const STORAGE_KEY = 'board43playground:editor';
const SAVE_DEBOUNCE_MS = 500;

const INITIAL_EDITOR_STATE: EditorState = {
  files: [],
  activeFileId: null,
  openFileIds: [],
};
const EDITOR_ROOT_PATH = '/home';

function loadFromStorage(): EditorState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed.files) &&
      parsed.files.every(
        (f: unknown) =>
          typeof f === 'object' &&
          f !== null &&
          typeof (f as EditorFile).id === 'string' &&
          typeof (f as EditorFile).name === 'string' &&
          typeof (f as EditorFile).content === 'string',
      )
    ) {
      return {
        files: parsed.files,
        activeFileId: parsed.activeFileId ?? null,
        openFileIds: Array.isArray(parsed.openFileIds)
          ? parsed.openFileIds
          : [],
      };
    }
  } catch {
    // corrupted data — ignore
  }
  return null;
}

function saveToStorage(state: EditorState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded — ignore
  }
}

interface LoadedFile {
  id?: string;
  name: string;
  content: string;
}

export function useEditorState() {
  const [state, setState] = useState<EditorState>(
    () => loadFromStorage() ?? INITIAL_EDITOR_STATE,
  );

  // Debounced persist to localStorage
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(
      () => saveToStorage(state),
      SAVE_DEBOUNCE_MS,
    );
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  const findFile = useCallback(
    (id: string): EditorFile | null => {
      return state.files.find((f) => f.id === id) ?? null;
    },
    [state.files],
  );

  const updateFileContent = useCallback((id: string, content: string) => {
    setState((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.id === id ? { ...f, content } : f)),
    }));
  }, []);

  const setActiveFile = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      activeFileId: id,
      openFileIds: prev.openFileIds.includes(id)
        ? prev.openFileIds
        : [...prev.openFileIds, id],
    }));
  }, []);

  const closeFile = useCallback((id: string) => {
    setState((prev) => {
      const newOpenIds = prev.openFileIds.filter((fid) => fid !== id);
      return {
        ...prev,
        openFileIds: newOpenIds,
        activeFileId:
          prev.activeFileId === id
            ? newOpenIds[newOpenIds.length - 1] || null
            : prev.activeFileId,
      };
    });
  }, []);

  const createFile = useCallback(
    async (name: string, _parentId?: string, initialContent?: string) => {
      const existingNames = new Set(state.files.map((f) => f.name));

      let finalName = name;
      if (existingNames.has(name)) {
        const lastDot = name.lastIndexOf('.');
        const rawBase = lastDot > 0 ? name.slice(0, lastDot) : name;
        const ext = lastDot > 0 ? name.slice(lastDot) : '';

        const suffixMatch = rawBase.match(/^(.*)_(\d+)$/);
        const baseName = suffixMatch ? suffixMatch[1] : rawBase;
        let counter = suffixMatch ? Number(suffixMatch[2]) + 1 : 1;

        do {
          finalName = `${baseName}_${counter}${ext}`;
          counter++;
        } while (existingNames.has(finalName));
      }

      const id = `${EDITOR_ROOT_PATH}/${finalName}`;
      const content = initialContent ?? `# ${finalName}\n`;
      const newFile: EditorFile = { id, name: finalName, content };

      setState((prev) => ({
        ...prev,
        files: [...prev.files, newFile],
        activeFileId: id,
        openFileIds: [...prev.openFileIds, id],
      }));

      return newFile;
    },
    [state.files],
  );

  const deleteFile = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f.id !== id),
      openFileIds: prev.openFileIds.filter((fid) => fid !== id),
      activeFileId: prev.activeFileId === id ? null : prev.activeFileId,
    }));
  }, []);

  const loadFilesFromDirectory = useCallback(
    (files: LoadedFile[]) => {
      const editorFiles: EditorFile[] = files.map((f) => ({
        id: f.id ?? `${EDITOR_ROOT_PATH}/${f.name}`,
        name: f.name,
        content: f.content,
      }));

      setState((prev) => {
        const prevActiveFile = prev.activeFileId
          ? findFile(prev.activeFileId)
          : null;
        const activeFileId = prevActiveFile
          ? (editorFiles.find((f) => f.name === prevActiveFile.name)?.id ??
            null)
          : null;
        const openFileIds = prev.openFileIds
          .map((id) => findFile(id))
          .filter((f): f is EditorFile => f !== null)
          .map((f) => editorFiles.find((ef) => ef.name === f.name))
          .filter((f): f is EditorFile => f !== undefined)
          .map((f) => f.id);

        return {
          files: editorFiles,
          activeFileId,
          openFileIds: Array.from(new Set(openFileIds)),
        };
      });
    },
    [findFile],
  );

  const activeFile = state.activeFileId ? findFile(state.activeFileId) : null;

  const getFileById = useCallback((id: string) => findFile(id), [findFile]);

  const insertTextAtEnd = useCallback(
    (text: string) => {
      if (!state.activeFileId) return;
      const file = findFile(state.activeFileId);
      if (!file) return;
      const newContent = file.content.endsWith('\n')
        ? `${file.content + text}\n`
        : `${file.content}\n${text}\n`;
      updateFileContent(state.activeFileId, newContent);
    },
    [state.activeFileId, findFile, updateFileContent],
  );

  return {
    ...state,
    activeFile,
    getFileById,
    updateFileContent,
    setActiveFile,
    closeFile,
    createFile,
    deleteFile,
    loadFilesFromDirectory,
    insertTextAtEnd,
  };
}
