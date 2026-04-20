import { useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

interface ContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  showCut: boolean;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  hasSelection,
  showCut,
  onCut,
  onCopy,
  onPaste,
  onClose,
}: ContextMenuProps) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8;
      }
      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8;
      }

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  const handleCut = useCallback(() => {
    onCut();
    onClose();
  }, [onCut, onClose]);

  const handleCopy = useCallback(() => {
    onCopy();
    onClose();
  }, [onCopy, onClose]);

  const handlePaste = useCallback(() => {
    onPaste();
    onClose();
  }, [onPaste, onClose]);

  return (
    <div ref={menuRef} className="context-menu" style={{ left: x, top: y }}>
      {showCut ? (
        <button
          type="button"
          className="context-menu-item"
          onClick={handleCut}
          disabled={!hasSelection}
        >
          {t('ctx.cut')}
        </button>
      ) : null}
      <button
        type="button"
        className="context-menu-item"
        onClick={handleCopy}
        disabled={!hasSelection}
      >
        {t('ctx.copy')}
      </button>
      <button type="button" className="context-menu-item" onClick={handlePaste}>
        {t('ctx.paste')}
      </button>
    </div>
  );
}
