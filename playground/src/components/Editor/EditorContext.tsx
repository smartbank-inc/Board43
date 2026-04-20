import { type ReactNode, createContext, useContext } from 'react';
import { useEditorState } from './useEditorState';

type EditorContextType = ReturnType<typeof useEditorState>;

const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const state = useEditorState();
  return (
    <EditorContext.Provider value={state}>{children}</EditorContext.Provider>
  );
}

export function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider');
  }
  return context;
}
