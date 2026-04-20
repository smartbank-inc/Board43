import { FitAddon, Terminal, init } from 'ghostty-web';
import { useCallback, useEffect, useRef } from 'react';

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

interface Props {
  onData?: (data: string) => void;
  terminalRef?: React.MutableRefObject<Terminal | null>;
  onReady?: () => void;
  onContextMenu?: (event: ContextMenuEvent) => void;
  localEcho?: boolean;
}

// Convert keyboard event to terminal-compatible data
function keyEventToData(e: React.KeyboardEvent): string | null {
  // Handle special keys
  if (e.ctrlKey) {
    // Ctrl+C, Ctrl+D, etc.
    if (e.key.length === 1) {
      const code = e.key.toUpperCase().charCodeAt(0) - 64;
      if (code >= 1 && code <= 26) {
        return String.fromCharCode(code);
      }
    }
    return null;
  }

  switch (e.key) {
    case 'Enter':
      return '\r';
    case 'Backspace':
      return '\x7f';
    case 'Tab':
      return '\t';
    case 'Escape':
      return '\x1b';
    case 'ArrowUp':
      return '\x1b[A';
    case 'ArrowDown':
      return '\x1b[B';
    case 'ArrowRight':
      return '\x1b[C';
    case 'ArrowLeft':
      return '\x1b[D';
    case 'Home':
      return '\x1b[H';
    case 'End':
      return '\x1b[F';
    case 'Delete':
      return '\x1b[3~';
    default:
      // Regular printable characters
      if (e.key.length === 1) {
        return e.key;
      }
      return null;
  }
}

export function GhosttyTerminal({
  onData,
  terminalRef,
  onReady,
  onContextMenu,
  localEcho = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalTermRef = useRef<Terminal | null>(null);
  const callbacksRef = useRef({
    onData,
    onReady,
    onContextMenu,
    localEcho,
  });
  const ghosttyOnDataActiveRef = useRef(false);
  callbacksRef.current = {
    onData,
    onReady,
    onContextMenu,
    localEcho,
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const term = internalTermRef.current;
    if (!term || !callbacksRef.current.onContextMenu) return;

    const getSelectionText = () => term.getSelection?.() ?? '';
    const hasSelection = (text: string) => text.trim().length > 0;

    e.preventDefault();
    callbacksRef.current.onContextMenu({
      x: e.clientX,
      y: e.clientY,
      selectedText: getSelectionText(),
      hasSelection: hasSelection(getSelectionText()),
      actions: {
        cut: () => {
          const text = getSelectionText();
          if (!hasSelection(text)) return;
          navigator.clipboard.writeText(text).catch(() => undefined);
        },
        copy: () => {
          const text = getSelectionText();
          if (!hasSelection(text)) return;
          navigator.clipboard.writeText(text).catch(() => undefined);
        },
        paste: async () => {
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              callbacksRef.current.onData?.(text);
            }
          } catch {
            /* ignore */
          }
        },
      },
    });
  }, []);

  const handleClick = useCallback(() => {
    // Focus ghostty's internal element for keyboard events
    internalTermRef.current?.focus();
  }, []);

  // Local echo helper - display typed characters immediately
  const echoToTerminal = useCallback((data: string) => {
    if (!callbacksRef.current.localEcho) return;
    const term = internalTermRef.current;
    if (!term) return;

    // Handle special characters for display
    if (data === '\r') {
      term.write('\r\n');
    } else if (data === '\x7f') {
      // Backspace: move cursor back, write space, move back again
      term.write('\b \b');
    } else if (data.startsWith('\x1b')) {
      // Don't echo escape sequences
    } else if (data.charCodeAt(0) < 32) {
      // Don't echo control characters (except those handled above)
    } else {
      term.write(data);
    }
  }, []);

  // Fallback keyboard handler in case ghostty's onData doesn't work
  // This is called when the container div receives keyboard events
  // (which happens when ghostty's internal element doesn't capture the focus)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Skip if ghostty's native keyboard handling is working
      if (ghosttyOnDataActiveRef.current) {
        return;
      }

      const data = keyEventToData(e);
      if (data) {
        e.preventDefault();
        // Local echo (if enabled)
        echoToTerminal(data);
        callbacksRef.current.onData?.(data);
      }
    },
    [echoToTerminal],
  );

  useEffect(() => {
    let mounted = true;
    let term: Terminal | null = null;

    (async () => {
      await init();
      if (!mounted || !containerRef.current) return;

      term = new Terminal({
        cols: 80,
        rows: 24,
        scrollback: 10000,
        fontSize: 14,
        fontFamily: '"JetBrains Mono", Monaco, "Courier New", monospace',
        cursorBlink: true,
        convertEol: true,
        // Terminal stays dark for contrast even under the light UI theme.
        theme: {
          background: '#0c0b0e',
          foreground: '#f0eef2',
          cursor: '#007aff',
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();
      fitAddon.observeResize();

      // Register onData callback - this is ghostty's native keyboard handling
      term.onData((data) => {
        // Mark that ghostty's native keyboard handling is working
        ghosttyOnDataActiveRef.current = true;
        callbacksRef.current.onData?.(data);
      });

      internalTermRef.current = term;
      if (terminalRef) terminalRef.current = term;

      // Ensure terminal is focused after initialization
      setTimeout(() => {
        internalTermRef.current?.focus();
      }, 100);

      callbacksRef.current.onReady?.();
    })().catch((err) => console.error('Terminal setup failed:', err));

    return () => {
      mounted = false;
      term?.dispose();
      internalTermRef.current = null;
      if (terminalRef) terminalRef.current = null;
      // Reset the flag so fallback handler can work if needed after re-mount
      ghosttyOnDataActiveRef.current = false;
    };
  }, [terminalRef]);

  return (
    <div
      ref={containerRef}
      role="textbox"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: '#0c0b0e',
        outline: 'none',
      }}
    />
  );
}
