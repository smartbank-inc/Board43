/**
 * LED Simulator panel with interactive LED matrix
 * Paint directly on the LEDs - no separate canvas needed
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Button, Label } from '..';
import { type MessageKey, useI18n } from '../../i18n';
import { FlexBox } from '../../layout';
import initImageTransformer, {
  transform as transformImage,
} from '../../wasm/image-transformer/board43_image_transformer';
import { LED_MATRIX_CONFIG } from '../../wasm/types';
import { LedMatrix, type LedMatrixHandle } from './LedMatrix';
import type { PaletteColor, RgbColor } from './designerTypes';
import { hexToRgb, rgbToHex } from './designerTypes';
import { type AnimationType, generatePixelCode } from './pixelCodegen';
import { RUBY_GEM_PIXELS } from './presets';
import type { EmulatorPanelProps } from './types';
import './EmulatorPanel.css';

// Default animation delay baked into the generated code. Participants can
// tweak `delay_ms` in the Ruby source to change the speed.
const DEFAULT_ANIMATION_DELAY_MS = 100;

// Curated palette shown in the paint toolbar. Black doubles as the eraser
// now that the dedicated erase button is gone.
const TOOLBAR_COLORS: PaletteColor[] = [
  { name: 'Red', color: [255, 0, 0] },
  { name: 'Yellow', color: [255, 255, 0] },
  { name: 'Green', color: [0, 255, 0] },
  { name: 'Cyan', color: [0, 255, 255] },
  { name: 'Blue', color: [0, 0, 255] },
  { name: 'Magenta', color: [255, 0, 255] },
  { name: 'White', color: [255, 255, 255] },
  { name: 'Black', color: [0, 0, 0] },
];

const ANIMATION_OPTIONS: {
  value: AnimationType;
  labelKey: MessageKey;
}[] = [
  { value: 'none', labelKey: 'emulator.animation.static' },
  { value: 'scroll_left', labelKey: 'emulator.animation.scrollLeft' },
  { value: 'scroll_right', labelKey: 'emulator.animation.scrollRight' },
  { value: 'scroll_up', labelKey: 'emulator.animation.scrollUp' },
  { value: 'scroll_down', labelKey: 'emulator.animation.scrollDown' },
  { value: 'fade', labelKey: 'emulator.animation.fade' },
  { value: 'rotate', labelKey: 'emulator.animation.rotate' },
];

export interface EmulatorPanelHandle {
  /** Open the OS file picker to upload an image into the LED canvas. */
  triggerImageUpload: () => void;
}

export const EmulatorPanel = forwardRef<
  EmulatorPanelHandle,
  EmulatorPanelProps
>(function EmulatorPanel({ state, targetPixels, onReplaceCode }, ref) {
  const { t, locale } = useI18n();
  const isRunning = state.running;
  const ledMatrixRef = useRef<LedMatrixHandle>(null);
  const config = LED_MATRIX_CONFIG;

  // Editor state — start with a friendly preset so the simulator isn't empty.
  const [editorPixels, setEditorPixels] = useState<number[]>(() => [
    ...RUBY_GEM_PIXELS,
  ]);
  const editorPixelsRef = useRef(editorPixels);
  useEffect(() => {
    editorPixelsRef.current = editorPixels;
  }, [editorPixels]);

  // When a run (preview or manual) finishes, freeze the final frame into
  // the editor canvas so the user keeps seeing it instead of snapping back
  // to whatever was painted before.
  const prevRunningRef = useRef(isRunning);
  const targetPixelsRef = useRef(targetPixels);
  useEffect(() => {
    targetPixelsRef.current = targetPixels;
  }, [targetPixels]);
  useEffect(() => {
    if (prevRunningRef.current && !isRunning) {
      const snapshot = targetPixelsRef.current;
      if (snapshot && snapshot.length > 0) {
        setEditorPixels([...snapshot]);
      }
    }
    prevRunningRef.current = isRunning;
  }, [isRunning]);
  const [currentColor, setCurrentColor] = useState<RgbColor>([255, 0, 0]);
  const [customColor, setCustomColor] = useState('#ff0000');
  const [animation, setAnimation] = useState<AnimationType>('none');
  const animationRef = useRef(animation);
  useEffect(() => {
    animationRef.current = animation;
  }, [animation]);

  // Undo/redo history
  const MAX_UNDO = 50;
  const undoStackRef = useRef<number[][]>([]);
  const redoStackRef = useRef<number[][]>([]);

  const pushUndo = useCallback((snapshot: number[]) => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_UNDO - 1)),
      snapshot,
    ];
    redoStackRef.current = [];
  }, []);

  const regenerateCode = useCallback(
    (pixels: number[]) => {
      const code = generatePixelCode(
        pixels,
        config,
        animationRef.current,
        DEFAULT_ANIMATION_DELAY_MS,
        locale,
      );
      onReplaceCode?.(code);
    },
    [config, onReplaceCode, locale],
  );

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setEditorPixels((current) => {
      redoStackRef.current = [...redoStackRef.current, current];
      return prev;
    });
    regenerateCode(prev);
  }, [regenerateCode]);

  const handleRedo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    const next = stack[stack.length - 1];
    redoStackRef.current = stack.slice(0, -1);
    setEditorPixels((current) => {
      undoStackRef.current = [...undoStackRef.current, current];
      return next;
    });
    regenerateCode(next);
  }, [regenerateCode]);

  // Keyboard shortcut for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isRunning) return;
      const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isRunning, handleUndo, handleRedo]);

  const handleStrokeStart = useCallback(() => {
    pushUndo(editorPixels);
  }, [pushUndo, editorPixels]);

  const handlePixelPaint = useCallback(
    (index: number) => {
      setEditorPixels((prev) => {
        const newPixels = [...prev];
        const i = index * 3;
        newPixels[i] = currentColor[0];
        newPixels[i + 1] = currentColor[1];
        newPixels[i + 2] = currentColor[2];
        return newPixels;
      });
    },
    [currentColor],
  );

  const handleStrokeEnd = useCallback(() => {
    regenerateCode(editorPixelsRef.current);
  }, [regenerateCode]);

  const handleClear = useCallback(() => {
    pushUndo(editorPixels);
    const cleared = new Array(config.count * 3).fill(0);
    setEditorPixels(cleared);
    regenerateCode(cleared);
  }, [config.count, pushUndo, editorPixels, regenerateCode]);

  const handlePresetClick = useCallback((color: RgbColor) => {
    setCurrentColor(color);
    setCustomColor(rgbToHex(...color));
  }, []);

  const handleCustomColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value;
      setCustomColor(hex);
      setCurrentColor(hexToRgb(hex));
    },
    [],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasmInitRef = useRef<Promise<void> | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      triggerImageUpload: () => {
        fileInputRef.current?.click();
      },
    }),
    [],
  );

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset input so the same file can be selected again
      e.target.value = '';

      // Lazy-init the WASM module
      if (!wasmInitRef.current) {
        wasmInitRef.current = initImageTransformer().then(() => {});
      }
      await wasmInitRef.current;

      const bytes = new Uint8Array(await file.arrayBuffer());
      const rgb = transformImage(bytes);
      const nextPixels = Array.from(rgb);
      pushUndo(editorPixels);
      setEditorPixels(nextPixels);

      // Immediately generate code from the freshly uploaded pixels so the
      // editor reflects the image. Running is left to the user.
      const code = generatePixelCode(
        nextPixels,
        config,
        animation,
        DEFAULT_ANIMATION_DELAY_MS,
        locale,
      );
      onReplaceCode?.(code);
    },
    [pushUndo, editorPixels, config, animation, onReplaceCode, locale],
  );

  const applyAnimation = useCallback(
    (anim: AnimationType) => {
      setAnimation(anim);
      const code = generatePixelCode(
        editorPixels,
        config,
        anim,
        DEFAULT_ANIMATION_DELAY_MS,
        locale,
      );
      onReplaceCode?.(code);
    },
    [editorPixels, config, onReplaceCode, locale],
  );

  // Show editor pixels when not running, runtime pixels when running
  const displayPixels = isRunning ? targetPixels : editorPixels;
  const isEditable = !isRunning;

  const toolbarDisabled = isRunning;

  return (
    <FlexBox className="emulator-panel">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />

      <FlexBox
        className={`emulator-toolbar ${toolbarDisabled ? 'toolbar-disabled' : ''}`}
        direction="row"
        align="center"
        gap="extra-small"
        wrap="wrap"
      >
        <Button
          appearance="outlined"
          size="small"
          width="hug"
          onClick={handleUndo}
          disabled={undoStackRef.current.length === 0}
          title={t('emulator.tool.undo.title')}
        >
          {t('emulator.tool.undo')}
        </Button>
        <Button
          appearance="outlined"
          size="small"
          width="hug"
          onClick={handleRedo}
          disabled={redoStackRef.current.length === 0}
          title={t('emulator.tool.redo.title')}
        >
          {t('emulator.tool.redo')}
        </Button>
        <Button
          appearance="outlined"
          size="small"
          width="hug"
          onClick={handleClear}
          title={t('emulator.tool.clear.title')}
        >
          {t('emulator.tool.clear')}
        </Button>

        <span className="toolbar-sep" />
        {TOOLBAR_COLORS.map((entry) => {
          const hex = rgbToHex(...entry.color);
          const isSelected = hex === rgbToHex(...currentColor);
          return (
            <button
              key={entry.name}
              type="button"
              className={`color-btn ${isSelected ? 'selected' : ''}`}
              style={{ backgroundColor: hex }}
              onClick={() => handlePresetClick(entry.color)}
              title={entry.name}
            />
          );
        })}
        <input
          type="color"
          value={customColor}
          onChange={handleCustomColorChange}
          className="color-picker"
          title={t('emulator.tool.customColor')}
        />
      </FlexBox>

      <FlexBox
        className="emulator-content"
        align="center"
        justify="center"
        grow={1}
      >
        <FlexBox
          className="emulator-matrix-container"
          direction="row"
          align="center"
          justify="center"
        >
          <LedMatrix
            ref={ledMatrixRef}
            targetPixels={displayPixels}
            editable={isEditable}
            paintColor={currentColor}
            onPixelPaint={handlePixelPaint}
            onStrokeStart={handleStrokeStart}
            onStrokeEnd={handleStrokeEnd}
          />
        </FlexBox>
      </FlexBox>

      <FlexBox
        className={`emulator-toolbar ${toolbarDisabled ? 'toolbar-disabled' : ''}`}
        direction="row"
        align="center"
        gap="extra-small"
        wrap="wrap"
      >
        <Label as="span" size="small" emphasis="mid" className="toolbar-label">
          {t('emulator.animation.label')}
        </Label>
        {ANIMATION_OPTIONS.map((opt) => {
          const label = t(opt.labelKey);
          return (
            <Button
              key={opt.value}
              appearance={
                animation === opt.value && opt.value !== 'none'
                  ? 'tonal'
                  : 'outlined'
              }
              size="small"
              width="hug"
              onClick={() => applyAnimation(opt.value)}
              title={t('emulator.animation.title', { label })}
            >
              {label}
            </Button>
          );
        })}
      </FlexBox>
    </FlexBox>
  );
});
