/**
 * LED matrix canvas component with 60fps interpolation.
 * Renders pixel data from PicoRuby with smooth color transitions.
 * Supports interactive painting when editable.
 */

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { LED_MATRIX_HEIGHT, LED_MATRIX_WIDTH } from '../../wasm/types';
import type { LedMatrixProps } from './types';
import './LedMatrix.css';

export interface LedMatrixHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

export type PaintMode = 'paint' | 'erase';

const LED_SIZE = 40;
const LED_GAP = 4;
const LED_RADIUS = 6;

// Minimum display brightness for LEDs (real LEDs are visible at very low values)
const MIN_DISPLAY_BRIGHTNESS = 120;

/**
 * Boost brightness values for screen display.
 * Real LEDs emit visible light even at very low values, but screens need higher RGB values.
 * This ensures all non-zero colors are clearly visible while preserving color ratios.
 */
function boostBrightness(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const max = Math.max(r, g, b);
  if (max === 0) return [0, 0, 0];

  // Always boost to at least MIN_DISPLAY_BRIGHTNESS, preserving color ratios
  // This makes brightness=1 look similar to brightness=50 on screen
  const targetBrightness = Math.max(max, MIN_DISPLAY_BRIGHTNESS);
  const scale = targetBrightness / max;
  return [
    Math.min(255, Math.round(r * scale)),
    Math.min(255, Math.round(g * scale)),
    Math.min(255, Math.round(b * scale)),
  ];
}

const LedMatrixInner = forwardRef<LedMatrixHandle, LedMatrixProps>(
  function LedMatrixInner(
    {
      targetPixels,
      width = LED_MATRIX_WIDTH,
      height = LED_MATRIX_HEIGHT,
      editable = false,
      paintColor: _paintColor = [255, 0, 0],
      onPixelPaint,
      onStrokeStart,
      onStrokeEnd,
    },
    ref,
  ) {
    void _paintColor;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isPainting, setIsPainting] = useState(false);

    // Expose canvas to parent via ref
    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
    }));
    const frameRef = useRef<Uint8Array>(new Uint8Array(width * height * 3));
    const animationRef = useRef<number>(0);

    useEffect(() => {
      frameRef.current = new Uint8Array(width * height * 3);
    }, [width, height]);

    // Update frame when props change
    useEffect(() => {
      if (targetPixels.length === width * height * 3) {
        frameRef.current = Uint8Array.from(targetPixels);
      }
    }, [targetPixels, width, height]);

    // Get pixel index from canvas coordinates
    const getPixelIndex = useCallback(
      (clientX: number, clientY: number): number | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        const pixelX = Math.floor((x - LED_GAP) / (LED_SIZE + LED_GAP));
        const pixelY = Math.floor((y - LED_GAP) / (LED_SIZE + LED_GAP));

        if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
          return null;
        }

        return pixelY * width + pixelX;
      },
      [width, height],
    );

    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        if (!editable || !onPixelPaint) return;
        e.preventDefault();
        const index = getPixelIndex(e.clientX, e.clientY);
        if (index !== null) {
          onStrokeStart?.();
          setIsPainting(true);
          onPixelPaint(index);
        }
      },
      [editable, getPixelIndex, onPixelPaint, onStrokeStart],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!isPainting || !editable || !onPixelPaint) return;
        const index = getPixelIndex(e.clientX, e.clientY);
        if (index !== null) {
          onPixelPaint(index);
        }
      },
      [isPainting, editable, getPixelIndex, onPixelPaint],
    );

    const handlePointerUp = useCallback(() => {
      if (isPainting) {
        onStrokeEnd?.();
      }
      setIsPainting(false);
    }, [isPainting, onStrokeEnd]);

    // Render function
    const render = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const frame = frameRef.current;

      // Clear canvas with dark background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw LEDs
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 3;
          const rawR = frame[i];
          const rawG = frame[i + 1];
          const rawB = frame[i + 2];

          // Boost dim colors to be visible on screen
          const [r, g, b] = boostBrightness(rawR, rawG, rawB);

          const px = x * (LED_SIZE + LED_GAP) + LED_GAP;
          const py = y * (LED_SIZE + LED_GAP) + LED_GAP;

          // Draw LED glow effect (only when there's color)
          const brightness = (r + g + b) / 3;
          if (brightness > 0) {
            const gradient = ctx.createRadialGradient(
              px + LED_SIZE / 2,
              py + LED_SIZE / 2,
              0,
              px + LED_SIZE / 2,
              py + LED_SIZE / 2,
              LED_SIZE,
            );
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(
              px - LED_SIZE / 2,
              py - LED_SIZE / 2,
              LED_SIZE * 2,
              LED_SIZE * 2,
            );
          }

          // Draw LED body
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.beginPath();
          ctx.roundRect(px, py, LED_SIZE, LED_SIZE, LED_RADIUS);
          ctx.fill();

          // Draw LED border/outline
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      animationRef.current = requestAnimationFrame(render);
    }, [width, height]);

    // Start animation loop
    useEffect(() => {
      animationRef.current = requestAnimationFrame(render);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [render]);

    const canvasWidth = width * (LED_SIZE + LED_GAP) + LED_GAP;
    const canvasHeight = height * (LED_SIZE + LED_GAP) + LED_GAP;

    return (
      <canvas
        ref={canvasRef}
        className={`led-matrix ${editable ? 'led-matrix-editable' : ''}`}
        width={canvasWidth}
        height={canvasHeight}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          cursor: editable ? 'crosshair' : 'default',
        }}
      />
    );
  },
);

export const LedMatrix = memo(LedMatrixInner, (prevProps, nextProps) => {
  // Check editable props first (they affect interactivity)
  if (
    prevProps.editable !== nextProps.editable ||
    prevProps.onPixelPaint !== nextProps.onPixelPaint
  ) {
    return false;
  }

  // Check paintColor
  if (prevProps.paintColor !== nextProps.paintColor) {
    if (!prevProps.paintColor || !nextProps.paintColor) return false;
    if (
      prevProps.paintColor[0] !== nextProps.paintColor[0] ||
      prevProps.paintColor[1] !== nextProps.paintColor[1] ||
      prevProps.paintColor[2] !== nextProps.paintColor[2]
    ) {
      return false;
    }
  }

  // Quick check for reference equality (common case when nothing changed)
  if (prevProps.targetPixels === nextProps.targetPixels) {
    return (
      prevProps.width === nextProps.width &&
      prevProps.height === nextProps.height
    );
  }

  // Check length first (fast)
  if (prevProps.targetPixels.length !== nextProps.targetPixels.length)
    return false;

  // Compare all pixel values for accurate updates
  const pixels = prevProps.targetPixels;
  const nextPixels = nextProps.targetPixels;
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] !== nextPixels[i]) return false;
  }

  return (
    prevProps.width === nextProps.width && prevProps.height === nextProps.height
  );
});
