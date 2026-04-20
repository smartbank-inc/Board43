import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '..';
import { useI18n } from '../../i18n';
import { FlexBox } from '../../layout';
import type { WasmRuntimeState } from '../../wasm/types';
import {
  EmulatorPanel,
  type EmulatorPanelHandle,
} from '../Emulator/EmulatorPanel';
import { CodeEditor } from './CodeEditor';
import { useEditorContext } from './EditorContext';
import { FileTabs } from './FileTabs';
import { OpenFromDeviceDialog } from './OpenFromDeviceDialog';
import type { DeviceFilesystem, EditorFile } from './types';
import './Editor.css';

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

interface EditorPaneProps {
  onContextMenu?: (event: ContextMenuEvent) => void;
  deviceFs?: DeviceFilesystem;
  emulatorState: WasmRuntimeState;
  emulatorPixels: number[];
  onReplaceCode?: (code: string) => void;
  onRunPreview?: () => void;
  onStopPreview?: () => void;
}

export function EditorPane({
  onContextMenu,
  deviceFs,
  emulatorState,
  emulatorPixels,
  onReplaceCode,
  onRunPreview,
  onStopPreview,
}: EditorPaneProps) {
  const { t } = useI18n();
  const {
    files,
    activeFile,
    activeFileId,
    openFileIds,
    getFileById,
    updateFileContent,
    setActiveFile,
    closeFile,
    createFile,
  } = useEditorContext();

  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const emulatorRef = useRef<EmulatorPanelHandle>(null);

  useEffect(() => {
    if (showNewFileInput && newFileInputRef.current) {
      newFileInputRef.current.focus();
    }
  }, [showNewFileInput]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(event.target as Node)
      ) {
        setShowNewFileInput(false);
      }
    };

    if (showNewFileInput) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNewFileInput]);

  const handleCreateFile = useCallback(() => {
    if (newFileName.trim()) {
      const name = newFileName.endsWith('.rb')
        ? newFileName
        : `${newFileName}.rb`;
      void createFile(name);
      setNewFileName('');
      setShowNewFileInput(false);
    }
  }, [newFileName, createFile]);

  const handleDeviceFilePicked = useCallback(
    (name: string, content: string) => {
      const targetId = `/home/${name}`;
      const existing = files.find((f) => f.id === targetId);
      if (existing) {
        setActiveFile(existing.id);
        return;
      }
      void createFile(name, undefined, content);
    },
    [files, setActiveFile, createFile],
  );

  const handleDownload = useCallback(() => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = activeFile.name || 'untitled.rb';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [activeFile]);

  const openFiles = openFileIds
    .map((id) => getFileById(id))
    .filter((f): f is EditorFile => f !== null);

  return (
    <FlexBox className="editor-pane">
      <FlexBox
        className="editor-toolbar"
        direction="row"
        justify="space-between"
        align="center"
        spacingHorizontal="medium"
      >
        <FileTabs
          openFiles={openFiles}
          activeFileId={activeFileId}
          onSelect={setActiveFile}
          onClose={closeFile}
        />
        <div className="editor-toolbar-actions">
          <div className="new-file-button-wrapper" ref={addMenuRef}>
            <Button
              appearance="outlined"
              size="small"
              width="hug"
              onClick={() => setShowNewFileInput((prev) => !prev)}
              disabled={emulatorState.running}
              title={t('editor.newFile.title')}
            >
              {t('editor.newFile')}
            </Button>
            {showNewFileInput && (
              <>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: decorative click-dismiss backdrop; keyboard users dismiss via the input's Escape handler */}
                <div
                  className="new-file-scrim"
                  onClick={() => setShowNewFileInput(false)}
                />
                <div className="add-menu-dropdown new-file-input-dropdown">
                  <FlexBox
                    className="editor-new-file"
                    direction="row"
                    gap="two-extra-small"
                    spacing="extra-small"
                  >
                    <input
                      ref={newFileInputRef}
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder={t('editor.newFile.placeholder')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFile();
                        if (e.key === 'Escape') setShowNewFileInput(false);
                      }}
                    />
                    <Button
                      appearance="filled"
                      size="small"
                      width="hug"
                      onClick={handleCreateFile}
                    >
                      {t('editor.newFile.add')}
                    </Button>
                  </FlexBox>
                </div>
              </>
            )}
          </div>
          <div className="open-file-button-wrapper">
            <Button
              appearance="outlined"
              size="small"
              width="hug"
              onClick={() => setShowOpenDialog(true)}
              disabled={!deviceFs || emulatorState.running}
              title={
                deviceFs ? t('editor.open.title') : t('editor.open.disabled')
              }
            >
              {t('editor.open')}
            </Button>
            {deviceFs && (
              <OpenFromDeviceDialog
                isActive={showOpenDialog}
                setIsActive={setShowOpenDialog}
                listRaw={deviceFs.listRaw}
                readFile={deviceFs.readFile}
                onPicked={handleDeviceFilePicked}
              />
            )}
          </div>
          <Button
            appearance="outlined"
            size="small"
            width="hug"
            onClick={() => emulatorRef.current?.triggerImageUpload()}
            disabled={emulatorState.running}
            title={t('editor.uploadImage.title')}
          >
            {t('editor.uploadImage')}
          </Button>
          {emulatorState.running ? (
            <Button
              appearance="destructive"
              size="small"
              width="hug"
              onClick={onStopPreview}
              title={t('editor.preview.stop.title')}
            >
              {t('editor.preview.stop')}
            </Button>
          ) : (
            <Button
              appearance="outlined"
              size="small"
              width="hug"
              onClick={onRunPreview}
              disabled={!activeFile}
              title={t('editor.preview.title')}
            >
              {t('editor.preview')}
            </Button>
          )}
          <Button
            appearance="outlined"
            size="small"
            width="hug"
            onClick={handleDownload}
            disabled={!activeFile || emulatorState.running}
            title={t('editor.download.title')}
          >
            {t('editor.download')}
          </Button>
        </div>
      </FlexBox>
      <div className="editor-content">
        <div className="editor-code-column">
          {activeFile ? (
            <CodeEditor
              key={activeFile.id}
              value={activeFile.content}
              onChange={(content) => updateFileContent(activeFile.id, content)}
              className="editor-code"
              onContextMenu={onContextMenu}
            />
          ) : (
            <FlexBox className="editor-empty" align="center" justify="center">
              {t('editor.empty')}
            </FlexBox>
          )}
        </div>
        <div className="editor-simulator-column">
          <EmulatorPanel
            ref={emulatorRef}
            state={emulatorState}
            targetPixels={emulatorPixels}
            onReplaceCode={onReplaceCode}
          />
        </div>
      </div>
    </FlexBox>
  );
}
