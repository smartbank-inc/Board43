import type { Terminal } from 'ghostty-web';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import {
  Banner,
  Body,
  Button,
  Headline,
  Label,
  Popup,
  Snackbar,
} from './components';
import { ContextMenu } from './components/ContextMenu';
import { resolveMessage, useI18n } from './i18n';
import type { Locale } from './i18n';
import { FlexBox } from './layout';

import {
  EditorPane,
  EditorProvider,
  useEditorContext,
} from './components/Editor';
import { GhosttyTerminal } from './components/GhosttyTerminal';
import { ResizeHandle } from './components/ResizeHandle';
import { SetupWizard } from './components/SetupWizard';
import { useDeviceFilesystem } from './hooks/useDeviceFilesystem';
import { usePicoRubyWasm } from './hooks/usePicoRubyWasm';
import { useSerial } from './hooks/useSerial';
import { LED_COUNT } from './wasm/types';

const DEVICE_HOME_PATH = '/home';
const STATUS_AUTO_CLEAR_MS = 2000;

const createInitialPixels = () => new Array(LED_COUNT * 3).fill(0);

/**
 * Generates a filename like `2026-04-12_13-45-22.rb` from the current local
 * time. Used as the default name for the first file the app creates so users
 * start with a non-app.rb name they can run against the device freely.
 */
function generateDefaultFilename(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${stamp}.rb`;
}

interface ContextMenuState {
  x: number;
  y: number;
  selectedText: string;
  hasSelection: boolean;
  source: 'editor' | 'terminal';
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  showCut: boolean;
}

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

// Wrapper to access editor context for setup
function AppContent({
  showSetupWizard,
  onSetupComplete,
  onSetupWizardOpen,
}: {
  showSetupWizard: boolean;
  onSetupComplete: () => void;
  onSetupWizardOpen: () => void;
}) {
  const { activeFile, files, updateFileContent, createFile } =
    useEditorContext();
  const { locale, setLocale, t } = useI18n();
  const terminalRef = useRef<Terminal | null>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const statusClearTimerRef = useRef<number | null>(null);
  const snackbarTimerRef = useRef<number | null>(null);
  const defaultFileCreatedRef = useRef(false);
  const [baudRate, setBaudRate] = useState(115200);
  const [terminalReady, setTerminalReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editorHeight, setEditorHeight] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [terminalKey, setTerminalKey] = useState(0);
  const [deviceRunning, setDeviceRunning] = useState(false);
  const [installConfirmOpen, setInstallConfirmOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    message: string;
    color: 'positive' | 'attention';
  } | null>(null);
  const [emulatorPixels, setEmulatorPixels] =
    useState<number[]>(createInitialPixels);
  const {
    connected: serialConnected,
    error,
    connectionError,
    unexpectedDisconnect,
    connect: serialConnect,
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
  } = useSerial(terminalRef);

  const clearStatusTimer = useCallback(() => {
    if (statusClearTimerRef.current !== null) {
      window.clearTimeout(statusClearTimerRef.current);
      statusClearTimerRef.current = null;
    }
  }, []);

  const setPersistentStatus = useCallback(
    (message: string | null) => {
      clearStatusTimer();
      setStatus(message);
    },
    [clearStatusTimer],
  );

  const showSnackbar = useCallback(
    (
      message: string,
      color: 'positive' | 'attention' = 'positive',
      options?: { persistent?: boolean; durationMs?: number },
    ) => {
      if (snackbarTimerRef.current !== null) {
        window.clearTimeout(snackbarTimerRef.current);
        snackbarTimerRef.current = null;
      }
      setSnackbar({ message, color });
      if (!options?.persistent) {
        snackbarTimerRef.current = window.setTimeout(() => {
          setSnackbar(null);
          snackbarTimerRef.current = null;
        }, options?.durationMs ?? 3000);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (snackbarTimerRef.current !== null) {
        window.clearTimeout(snackbarTimerRef.current);
      }
    };
  }, []);

  const setTransientStatus = useCallback(
    (message: string, delayMs = STATUS_AUTO_CLEAR_MS) => {
      clearStatusTimer();
      setStatus(message);
      statusClearTimerRef.current = window.setTimeout(() => {
        setStatus((current) => (current === message ? null : current));
        statusClearTimerRef.current = null;
      }, delayMs);
    },
    [clearStatusTimer],
  );

  const deviceFs = useDeviceFilesystem({
    connected: serialConnected,
    writeRaw,
    sendRawAndWaitForText,
    startBinaryCapture,
    stopBinaryCapture,
    suppressNextTerminalLineWithPrefix,
    binaryRead,
    binaryReadExact,
  });

  const editorDeviceFs = useMemo(
    () =>
      serialConnected
        ? {
            listRaw: () => sendCommand('ls /home'),
            readFile: (path: string) => deviceFs.readFile(path),
          }
        : undefined,
    [serialConnected, sendCommand, deviceFs.readFile],
  );

  // When true, frames from WASM are a "preview" of the active tab; we let
  // them update the display for a short window then stop the worker so
  // animations don't keep running just because the user switched tabs.
  // A first-frame snapshot isn't enough because most LED code starts with
  // `led.clear; led.show` before drawing — we'd catch the blank frame.
  const previewModeRef = useRef(false);
  const previewStopTimerRef = useRef<number | null>(null);
  const stopWasmRef = useRef<() => void>(() => {});
  const PREVIEW_DURATION_MS = 300;

  // PicoRuby WASM runtime for emulator mode
  const {
    state: wasmState,
    loadRuntime: loadWasmRuntime,
    execute: executeWasm,
    stop: stopWasm,
  } = usePicoRubyWasm({
    onFrame: setEmulatorPixels,
    onError: (message) => {
      // Swallow preview-mode errors silently — they shouldn't nag the user.
      if (previewModeRef.current) {
        previewModeRef.current = false;
        if (previewStopTimerRef.current) {
          window.clearTimeout(previewStopTimerRef.current);
          previewStopTimerRef.current = null;
        }
        return;
      }
      setPersistentStatus(t('status.simulatorError', { message }));
    },
  });
  stopWasmRef.current = stopWasm;

  // Pre-load WASM runtime on mount (emulator is always visible)
  useEffect(() => {
    if (!wasmState.ready && !wasmState.loading) {
      loadWasmRuntime();
    }
  }, [wasmState.ready, wasmState.loading, loadWasmRuntime]);

  // Preview the active tab's LED state: on tab switch, execute the file and
  // let it run for PREVIEW_DURATION_MS before stopping so the user sees the
  // actual drawn state (not just the cleared first frame). executeWasm
  // internally (re-)initializes the worker; we deliberately omit wasmState
  // from deps to avoid re-firing when our own stop() flips ready back.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only tab switch should trigger
  useEffect(() => {
    if (!activeFile) return;
    const code = activeFile.content.trim();
    if (!code) return;

    if (previewStopTimerRef.current) {
      window.clearTimeout(previewStopTimerRef.current);
    }

    previewModeRef.current = true;
    executeWasm(activeFile.content);

    previewStopTimerRef.current = window.setTimeout(() => {
      previewStopTimerRef.current = null;
      if (previewModeRef.current) {
        previewModeRef.current = false;
        stopWasmRef.current();
      }
    }, PREVIEW_DURATION_MS);

    return () => {
      if (previewStopTimerRef.current) {
        window.clearTimeout(previewStopTimerRef.current);
        previewStopTimerRef.current = null;
      }
    };
  }, [activeFile?.id]);

  // Show setup wizard when device is disconnected. `t` is in the dep list so
  // the status-bar text re-resolves when the user switches locale.
  useEffect(() => {
    if (unexpectedDisconnect && connectionError) {
      setPersistentStatus(resolveMessage(t, connectionError));
      onSetupWizardOpen();
    }
  }, [
    connectionError,
    unexpectedDisconnect,
    onSetupWizardOpen,
    setPersistentStatus,
    t,
  ]);

  useEffect(() => {
    return clearStatusTimer;
  }, [clearStatusTimer]);

  useEffect(() => {
    if (showSetupWizard || !serialConnected || !terminalReady) {
      return;
    }
    void startReadLoop();
  }, [showSetupWizard, serialConnected, terminalReady, startReadLoop]);

  useEffect(() => {
    if (showSetupWizard || !serialConnected || !terminalReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      void write('\r');
    }, 100);
    return () => window.clearTimeout(timer);
  }, [showSetupWizard, serialConnected, terminalReady, write]);

  useEffect(() => {
    if (files.length > 0) {
      defaultFileCreatedRef.current = true;
      return;
    }
    if (defaultFileCreatedRef.current) {
      return;
    }
    defaultFileCreatedRef.current = true;
    void createFile(generateDefaultFilename(), undefined, '');
  }, [files.length, createFile]);

  const handleEditorResize = useCallback((delta: number) => {
    setEditorHeight((prev) => {
      if (prev === null && rightPanelRef.current) {
        const panelHeight = rightPanelRef.current.clientHeight;
        return Math.max(
          100,
          Math.min(panelHeight - 100, panelHeight / 2 + delta),
        );
      }
      const panelHeight = rightPanelRef.current?.clientHeight ?? 600;
      return Math.max(
        100,
        Math.min(panelHeight - 100, (prev ?? panelHeight / 2) + delta),
      );
    });
  }, []);

  const handleEditorContextMenu = useCallback((event: ContextMenuEvent) => {
    setContextMenu({
      x: event.x,
      y: event.y,
      selectedText: event.selectedText,
      hasSelection: event.hasSelection,
      source: 'editor',
      onCut: event.actions.cut,
      onCopy: event.actions.copy,
      onPaste: event.actions.paste,
      showCut: true,
    });
  }, []);

  const handleTerminalContextMenu = useCallback((event: ContextMenuEvent) => {
    setContextMenu({
      x: event.x,
      y: event.y,
      selectedText: event.selectedText,
      hasSelection: event.hasSelection,
      source: 'terminal',
      onCut: event.actions.cut,
      onCopy: event.actions.copy,
      onPaste: event.actions.paste,
      showCut: false,
    });
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRunEmulator = useCallback(
    (code?: string) => {
      if (!activeFile) {
        setPersistentStatus(t('status.noFile'));
        return;
      }
      previewModeRef.current = false;
      if (previewStopTimerRef.current) {
        window.clearTimeout(previewStopTimerRef.current);
        previewStopTimerRef.current = null;
      }
      setEmulatorPixels(createInitialPixels);
      executeWasm(code ?? activeFile.content);
      setTransientStatus(t('status.started', { name: activeFile.name }));
    },
    [activeFile, executeWasm, setPersistentStatus, setTransientStatus, t],
  );

  const handleRunDevice = useCallback(async () => {
    if (!activeFile) {
      setPersistentStatus(t('status.noFile'));
      return;
    }
    if (!serialConnected) {
      setPersistentStatus(t('status.notConnected'));
      return;
    }

    try {
      // Upload using the editor's current filename so successive runs
      // overwrite the same file on the device instead of accumulating.
      const devicePath = `${DEVICE_HOME_PATH}/${activeFile.name}`;
      setTransientStatus(t('status.uploading', { name: activeFile.name }));
      showSnackbar(
        t('snackbar.uploading', { name: activeFile.name }),
        'positive',
        { persistent: true },
      );
      await deviceFs.writeFile(devicePath, activeFile.content);
      const sent = await write(`${devicePath}\r`);
      if (!sent) {
        throw new Error('Failed to send run command to device');
      }
      setTransientStatus(t('status.started', { name: activeFile.name }));
      showSnackbar(
        t('snackbar.running', { name: activeFile.name }),
        'positive',
      );
      setDeviceRunning(true);
      terminalRef.current?.focus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Run failed:', err);
      setPersistentStatus(t('status.runFailed', { message }));
      showSnackbar(t('snackbar.runFailed', { message }), 'attention');
    }
  }, [
    activeFile,
    serialConnected,
    deviceFs,
    setPersistentStatus,
    setTransientStatus,
    showSnackbar,
    write,
    t,
  ]);

  const handleStopDevice = useCallback(async () => {
    if (!serialConnected) return;
    // Send Ctrl-C to interrupt whatever is running on the device.
    await write('\x03');
    setDeviceRunning(false);
    setTransientStatus(t('status.stopped'));
  }, [serialConnected, write, setTransientStatus, t]);

  const handleInstallOnDevice = useCallback(() => {
    if (!activeFile || !serialConnected) return;
    setInstallConfirmOpen(true);
  }, [activeFile, serialConnected]);

  const handleConfirmInstallOnDevice = useCallback(async () => {
    if (!activeFile || !serialConnected) return;
    setInstallConfirmOpen(false);
    try {
      showSnackbar(
        t('snackbar.installing', { name: activeFile.name }),
        'positive',
        { persistent: true },
      );
      await deviceFs.writeFile('/home/app.rb', activeFile.content);
      showSnackbar(
        t('snackbar.installed', { name: activeFile.name }),
        'positive',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Install failed:', err);
      showSnackbar(t('snackbar.installFailed', { message }), 'attention');
    }
  }, [activeFile, serialConnected, deviceFs, showSnackbar, t]);

  // Reset device running state when the serial connection drops, otherwise the
  // button could get stuck in the "Stop on Device" state with no device behind
  // it.
  useEffect(() => {
    if (!serialConnected) {
      setDeviceRunning(false);
    }
  }, [serialConnected]);

  const handleSetupConnect = useCallback(
    async (port?: SerialPort) => {
      setTransientStatus(t('status.connecting'));
      const result = await serialConnect(baudRate, port);
      if (result.success) {
        setTransientStatus(t('status.connected'));
      } else {
        setPersistentStatus(
          result.error
            ? resolveMessage(t, result.error)
            : t('status.connectFailed'),
        );
      }
      return result;
    },
    [serialConnect, baudRate, setPersistentStatus, setTransientStatus, t],
  );

  const handleStartFromWizard = useCallback(() => {
    onSetupComplete();
    setTerminalKey((k) => k + 1);
    setTerminalReady(false);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      terminalRef.current?.focus();
    }, 200);
  }, [onSetupComplete]);

  const isSetupComplete = serialConnected;

  return (
    <>
      {showSetupWizard && (
        <SetupWizard
          serialConnected={serialConnected}
          baudRate={baudRate}
          connectionError={connectionError}
          onBaudRateChange={setBaudRate}
          onConnectSerial={handleSetupConnect}
          onClearConnectionError={clearConnectionError}
          onStart={handleStartFromWizard}
        />
      )}
      <FlexBox className="app" gap="extra-small" spacing="medium">
        <FlexBox
          as="header"
          className="header"
          direction="row"
          align="center"
          gap="small"
          spacingHorizontal="medium"
        >
          <Headline as="h1" size="medium" className="title">
            {t('header.title')}
          </Headline>
          <Body size="small" className="subtitle">
            {t('header.subtitle')}
          </Body>
          <FlexBox direction="row" align="center" gap="extra-small" width="hug">
            {deviceRunning ? (
              <Button
                appearance="destructive"
                size="small"
                width="hug"
                onClick={handleStopDevice}
                disabled={!serialConnected}
                title={t('header.run.device.stop.title')}
              >
                {t('header.run.device.stop')}
              </Button>
            ) : (
              <Button
                appearance="filled"
                size="small"
                width="hug"
                onClick={handleRunDevice}
                disabled={!activeFile || !serialConnected}
                title={
                  serialConnected
                    ? t('header.run.device.title.connected')
                    : t('header.run.device.title.disconnected')
                }
              >
                {t('header.run.device')}
              </Button>
            )}
            <Button
              appearance="outlined"
              size="small"
              width="hug"
              onClick={handleInstallOnDevice}
              disabled={!activeFile || !serialConnected || deviceRunning}
              title={
                serialConnected
                  ? t('header.install.title', { name: activeFile?.name ?? '' })
                  : t('header.run.device.title.disconnected')
              }
            >
              {t('header.install')}
            </Button>
          </FlexBox>
        </FlexBox>

        {error ? <Banner color="negative" title={error} /> : null}

        <FlexBox
          as="section"
          className="main-content"
          direction="row"
          gap="two-extra-small"
          grow={1}
        >
          <div className="right-panel" ref={rightPanelRef}>
            <div
              className="editor-emulator-row"
              style={
                editorHeight
                  ? { height: editorHeight, flex: 'none' }
                  : undefined
              }
            >
              <div className="editor-panel">
                <EditorPane
                  onContextMenu={handleEditorContextMenu}
                  deviceFs={editorDeviceFs}
                  emulatorState={wasmState}
                  emulatorPixels={emulatorPixels}
                  onReplaceCode={
                    activeFile
                      ? (code: string) => updateFileContent(activeFile.id, code)
                      : undefined
                  }
                  onRunPreview={() => handleRunEmulator()}
                  onStopPreview={stopWasm}
                />
              </div>
            </div>
            <ResizeHandle direction="vertical" onResize={handleEditorResize} />
            <div className="terminal-panel">
              <FlexBox
                className="terminal-header"
                direction="row"
                justify="space-between"
                align="center"
                spacingHorizontal="medium"
              >
                <Label as="span" size="small" className="terminal-label">
                  {t('terminal.label')}
                </Label>
                {!isSetupComplete && (
                  <FlexBox
                    className="terminal-controls"
                    direction="row"
                    align="center"
                    gap="extra-small"
                    width="hug"
                  >
                    <Button
                      appearance="filled"
                      size="small"
                      width="hug"
                      onClick={onSetupWizardOpen}
                    >
                      {t('terminal.setup')}
                    </Button>
                  </FlexBox>
                )}
              </FlexBox>
              <div className="terminal-container">
                <GhosttyTerminal
                  key={terminalKey}
                  terminalRef={terminalRef}
                  onData={write}
                  localEcho={false}
                  onReady={() => {
                    setTerminalReady(true);
                    // Ensure terminal is properly sized after initialization
                    setTimeout(() => {
                      window.dispatchEvent(new Event('resize'));
                    }, 50);
                  }}
                  onContextMenu={handleTerminalContextMenu}
                />
              </div>
            </div>
          </div>
        </FlexBox>

        {contextMenu ? (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hasSelection={contextMenu.hasSelection}
            showCut={contextMenu.showCut}
            onCut={contextMenu.onCut}
            onCopy={contextMenu.onCopy}
            onPaste={contextMenu.onPaste}
            onClose={handleContextMenuClose}
          />
        ) : null}

        <FlexBox
          as="footer"
          className="status-bar"
          direction="row"
          justify="space-between"
          align="center"
          spacingHorizontal="medium"
        >
          <Body as="span" size="small" className="status-message">
            {status || t('status.ready')}
          </Body>
          <FlexBox
            className="status-right"
            direction="row"
            align="center"
            gap="small"
            width="hug"
          >
            <select
              className="language-select"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label={t('app.language.label')}
            >
              <option value="en">English</option>
              <option value="ja">Japanese</option>
            </select>
            <Body as="span" size="small" className="footer-credits">
              Powered by{' '}
              <a
                href="https://smartbank.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-company"
              >
                SmartBank, Inc.
              </a>
              , runs on{' '}
              <a
                href="https://picoruby.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-runtime"
              >
                PicoRuby
              </a>
            </Body>
          </FlexBox>
        </FlexBox>
      </FlexBox>
      <Snackbar
        isActive={snackbar !== null}
        color={snackbar?.color ?? 'positive'}
      >
        {snackbar?.message ?? ''}
      </Snackbar>
      <Popup
        isActive={installConfirmOpen}
        setIsActive={setInstallConfirmOpen}
        title={t('popup.install.title', {
          name: activeFile?.name ?? '',
        })}
        description={
          <>
            {t('popup.install.description.line1', {
              name: activeFile?.name ?? '',
            })}
            <br />
            <br />
            {t('popup.install.description.line2')}
          </>
        }
        footer={
          <FlexBox direction="row" gap="extra-small" justify="flex-end">
            <Button
              appearance="outlined"
              width="hug"
              onClick={() => setInstallConfirmOpen(false)}
            >
              {t('popup.install.cancel')}
            </Button>
            <Button
              appearance="filled"
              width="hug"
              onClick={handleConfirmInstallOnDevice}
            >
              {t('popup.install.confirm')}
            </Button>
          </FlexBox>
        }
      />
    </>
  );
}

export default function App() {
  const [showSetupWizard, setShowSetupWizard] = useState(true);

  const handleSetupComplete = useCallback(() => {
    setShowSetupWizard(false);
  }, []);

  const handleSetupWizardOpen = useCallback(() => {
    setShowSetupWizard(true);
  }, []);

  return (
    <EditorProvider>
      <AppContent
        showSetupWizard={showSetupWizard}
        onSetupComplete={handleSetupComplete}
        onSetupWizardOpen={handleSetupWizardOpen}
      />
    </EditorProvider>
  );
}
