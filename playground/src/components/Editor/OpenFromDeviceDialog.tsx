import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '..';
import { useI18n } from '../../i18n';
import { FlexBox } from '../../layout';
import { parseLsOutput } from '../../utils/parseLs';
import './OpenFromDeviceDialog.css';

interface OpenFromDeviceDialogProps {
  isActive: boolean;
  setIsActive: (next: boolean) => void;
  /** Runs `ls /home` (or equivalent) on the device shell and returns raw stdout. */
  listRaw: () => Promise<string>;
  /** Reads a file from the device at the given absolute path. */
  readFile: (path: string) => Promise<string>;
  /** Called when the user picks a file and the content has been fetched. */
  onPicked: (name: string, content: string) => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'list'; files: string[] }
  | { kind: 'error'; message: string };

export function OpenFromDeviceDialog({
  isActive,
  setIsActive,
  listRaw,
  readFile,
  onPicked,
}: OpenFromDeviceDialogProps) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [picking, setPicking] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const raw = await listRaw();
      const files = parseLsOutput(raw);
      setState({ kind: 'list', files });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: 'error', message });
    }
  }, [listRaw]);

  useEffect(() => {
    if (isActive) {
      void load();
    }
  }, [isActive, load]);

  useEffect(() => {
    if (!isActive) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsActive(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsActive(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, setIsActive]);

  const handlePick = useCallback(
    async (name: string) => {
      setPicking(name);
      try {
        const content = await readFile(`/home/${name}`);
        onPicked(name, content);
        setIsActive(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', message });
      } finally {
        setPicking(null);
      }
    },
    [readFile, onPicked, setIsActive],
  );

  if (!isActive) return null;

  return (
    <div ref={wrapperRef}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: decorative click-dismiss backdrop; keyboard users dismiss via the document-level Escape handler above */}
      <div
        className="open-from-device-scrim"
        onClick={() => setIsActive(false)}
      />
      <div className="add-menu-dropdown open-from-device-dropdown">
        <FlexBox
          className="open-from-device-body"
          gap="small"
          spacing="extra-small"
        >
          {state.kind === 'loading' && (
            <span className="open-from-device-hint">
              {t('editor.open.loading')}
            </span>
          )}

          {state.kind === 'error' && (
            <FlexBox gap="extra-small">
              <span className="open-from-device-error">
                {t('editor.open.error')}: {state.message}
              </span>
              <div>
                <Button
                  appearance="tonal"
                  size="small"
                  width="hug"
                  onClick={() => void load()}
                >
                  {t('editor.open.retry')}
                </Button>
              </div>
            </FlexBox>
          )}

          {state.kind === 'list' && state.files.length === 0 && (
            <span className="open-from-device-hint">
              {t('editor.open.empty')}
            </span>
          )}

          {state.kind === 'list' && state.files.length > 0 && (
            <FlexBox gap="two-extra-small">
              {state.files.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="open-from-device-row"
                  onClick={() => void handlePick(name)}
                  disabled={picking !== null}
                >
                  {name}
                  {picking === name && (
                    <span className="open-from-device-picking">
                      {' '}
                      — {t('editor.open.reading')}
                    </span>
                  )}
                </button>
              ))}
            </FlexBox>
          )}
        </FlexBox>
      </div>
    </div>
  );
}
