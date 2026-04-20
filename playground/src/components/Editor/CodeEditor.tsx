import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  StreamLanguage,
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';

interface ContextMenuEvent {
  x: number;
  y: number;
  selectedText: string;
  hasSelection: boolean;
  actions: {
    cut: () => void;
    copy: () => void;
    paste: () => void;
  };
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  onContextMenu?: (event: ContextMenuEvent) => void;
}

export function CodeEditor({
  value,
  onChange,
  className,
  onContextMenu,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onContextMenuRef = useRef(onContextMenu);
  const [initialValue] = useState(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onContextMenuRef.current = onContextMenu;
  }, [onContextMenu]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const copySelection = async () => {
      const currentView = viewRef.current;
      if (!currentView) return;
      const selection = currentView.state.selection.main;
      if (selection.empty) return;
      const text = currentView.state.sliceDoc(selection.from, selection.to);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        try {
          currentView.focus();
          document.execCommand('copy');
        } catch {
          /* ignore */
        }
      }
    };

    const cutSelection = async () => {
      const currentView = viewRef.current;
      if (!currentView) return;
      const selection = currentView.state.selection.main;
      if (selection.empty) return;
      const text = currentView.state.sliceDoc(selection.from, selection.to);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        try {
          currentView.focus();
          document.execCommand('copy');
        } catch {
          /* ignore */
        }
      }
      currentView.dispatch({
        changes: { from: selection.from, to: selection.to, insert: '' },
      });
    };

    const pasteSelection = async () => {
      const currentView = viewRef.current;
      if (!currentView) return;
      currentView.focus();
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return;
        const selection = currentView.state.selection.main;
        currentView.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text },
          selection: { anchor: selection.from + text.length },
        });
      } catch {
        try {
          document.execCommand('paste');
        } catch {
          /* ignore */
        }
      }
    };

    const contextMenuHandler = EditorView.domEventHandlers({
      contextmenu: (event, view) => {
        if (!onContextMenuRef.current) {
          return false;
        }
        const selection = view.state.selection.main;
        const selectedText = selection.empty
          ? ''
          : view.state.sliceDoc(selection.from, selection.to);
        const hasSelection = !selection.empty && selectedText.length > 0;

        event.preventDefault();
        onContextMenuRef.current({
          x: event.clientX,
          y: event.clientY,
          selectedText,
          hasSelection,
          actions: {
            cut: () => void cutSelection(),
            copy: () => void copySelection(),
            paste: () => void pasteSelection(),
          },
        });
        return true;
      },
    });

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        EditorView.lineWrapping,
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        StreamLanguage.define(ruby),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        updateListener,
        contextMenuHandler,
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: 'var(--font-size-small)',
            color: 'var(--color-text-default-high)',
            backgroundColor: 'var(--color-background-default-base)',
          },
          '.cm-scroller': {
            fontFamily: 'var(--font-mono)',
            fontVariantLigatures: 'none',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--color-background-default-accent)',
            color: 'var(--color-text-default-low)',
            borderRight: '1px solid var(--color-border-default-low)',
          },
          '.cm-activeLine': {
            backgroundColor: 'var(--color-state-default-selected)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'var(--color-state-default-selected)',
            color: 'var(--color-text-default-high)',
          },
          '.cm-selectionBackground, &.cm-focused > .cm-scroller .cm-selectionBackground, ::selection':
            {
              backgroundColor: 'var(--color-interactive-container)',
            },
          '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: 'var(--color-interactive-base)',
          },
          '.cm-matchingBracket, .cm-nonmatchingBracket': {
            backgroundColor: 'var(--color-interactive-container)',
            outline: '1px solid var(--color-interactive-base)',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [initialValue]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return <div ref={containerRef} className={className} />;
}
