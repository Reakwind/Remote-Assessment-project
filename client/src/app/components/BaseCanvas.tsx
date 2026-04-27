/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useEffect, useState } from "react";
import { clsx } from "clsx";
import { RotateCcw, Trash2 } from "lucide-react";
import { isPatientSurface } from "../surface";

const EMPTY_STROKES: any[][] = [];

export function BaseCanvas({ 
  width = 800, 
  height = 500, 
  onDrawChange,
  onSave,
  initialStrokes = EMPTY_STROKES,
  backgroundImageUrl,
  backgroundPadding = 0,
  showStylusOnlyToggle = false,
}: { 
  width?: number; 
  height?: number;
  onDrawChange?: (strokes: any[]) => void;
  onSave?: (dataUrl: string, strokes: any[][]) => void;
  initialStrokes?: any[][];
  backgroundImageUrl?: string | null;
  backgroundPadding?: number;
  showStylusOnlyToggle?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [strokes, setStrokes] = useState<any[][]>(initialStrokes);
  const strokesRef = useRef<any[][]>(initialStrokes);
  const currentStrokeRef = useRef<any[]>([]);
  const [stylusOnly, setStylusOnly] = useState(false);

  const getLogicalPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      x: (e.clientX - rect.left) * (width / rect.width),
      y: (e.clientY - rect.top) * (height / rect.height),
    };
  };

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { desynchronized: true });
    if (!ctx) return;
    
    // Set up high-res canvas for retina displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Reset transform to avoid scaling multiple times
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000000";

    redrawCanvas(ctx, width, height, initialStrokes, backgroundImageUrl, backgroundPadding).catch((error) => {
      if (!cancelled) console.error("Failed to draw canvas background:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [width, height, initialStrokes, backgroundImageUrl, backgroundPadding]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (stylusOnly && e.pointerType === "touch") return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Some test/browser contexts can reject capture; drawing still works in-canvas.
    }

    const point = getLogicalPoint(e);
    if (!point) return;
    const { x, y } = point;

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    
    const newPoint = { x, y, time: Date.now(), pressure: e.pressure || 0.5, pointerType: e.pointerType };
    currentStrokeRef.current = [newPoint];
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    if (stylusOnly && e.pointerType === "touch") return;

    const point = getLogicalPoint(e);
    if (!point) return;
    const { x, y } = point;
    const newPoint = { x, y, time: Date.now(), pressure: e.pressure || 0.5, pointerType: e.pointerType };

    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.lineTo(x, y);
      ctx.stroke();
      currentStrokeRef.current.push(newPoint);
    });
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be gone after cancellation/lost capture.
      }
    }
    
    if (currentStrokeRef.current.length > 0) {
      const newStrokes = [...strokesRef.current, currentStrokeRef.current];
      strokesRef.current = newStrokes;
      setStrokes(newStrokes);
      if (onDrawChange) onDrawChange(newStrokes);
      if (onSave && canvas) onSave(canvas.toDataURL(), newStrokes);
    }
    currentStrokeRef.current = [];
  };

  const handleClear = () => {
    if (!window.confirm("האם למחוק את כל הציור?")) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    redrawCanvas(ctx, width, height, [], backgroundImageUrl, backgroundPadding).catch((error) => {
      console.error("Failed to clear canvas background:", error);
    });
    strokesRef.current = [];
    setStrokes([]);
    if (onDrawChange) onDrawChange([]);
    if (onSave) onSave("", []);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    
    const newStrokes = strokesRef.current.slice(0, -1);
    strokesRef.current = newStrokes;
    setStrokes(newStrokes);
    if (onDrawChange) onDrawChange(newStrokes);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    redrawCanvas(ctx, width, height, newStrokes, backgroundImageUrl, backgroundPadding).catch((error) => {
      console.error("Failed to undo canvas stroke:", error);
    });

    if (onSave) onSave(canvas.toDataURL(), newStrokes);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full min-w-0">
      {isPatientSurface && (
        <div className="w-full rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-right text-sm font-bold leading-relaxed text-blue-950 md:hidden">
          אם אתה משתמש בטלפון, מומלץ לסובב את המכשיר לרוחב לפני הציור.
        </div>
      )}

      {showStylusOnlyToggle && (
      <div className="flex justify-between items-center w-full px-1 sm:px-2">
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="stylus-only" 
            checked={stylusOnly} 
            onChange={(e) => setStylusOnly(e.target.checked)}
            className="w-5 h-5 accent-black cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50"
          />
          <label htmlFor="stylus-only" className="text-sm sm:text-base text-gray-700 font-medium cursor-pointer select-none">
            התעלם ממגע (עט חכם בלבד)
          </label>
        </div>
      </div>
      )}

      <div
        className="relative w-full select-none overflow-hidden overscroll-contain rounded-xl border-2 border-gray-200 bg-white shadow-sm touch-none transition-all focus-within:ring-4 focus-within:ring-blue-600 focus-within:ring-opacity-50"
        style={{ maxWidth: `${width}px` }}
      >
        <canvas
          ref={canvasRef}
          data-testid="drawing-canvas"
          role="img"
          aria-label="אזור לציור"
          tabIndex={0}
          className="block w-full max-w-full outline-none touch-none"
          style={{
            aspectRatio: `${width} / ${height}`,
            height: "auto",
            cursor: "crosshair",
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onLostPointerCapture={stopDrawing}
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full justify-center">
        <button 
          onClick={handleUndo} 
          disabled={strokes.length === 0}
          className={clsx(
            "px-5 sm:px-6 py-3 rounded-lg font-bold text-base sm:text-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50",
            strokes.length === 0 
              ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed" 
              : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100"
          )}
        >
          <RotateCcw className="h-5 w-5" />
          <span>בטל פעולה</span>
        </button>
        <button 
          onClick={handleClear}
          disabled={strokes.length === 0}
          className={clsx(
            "px-5 sm:px-6 py-3 rounded-lg font-bold text-base sm:text-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50",
            strokes.length === 0 
              ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed" 
              : "border-gray-300 text-red-600 bg-white hover:bg-red-50 hover:border-red-200 active:bg-red-100"
          )}
        >
          <Trash2 className="h-5 w-5" />
          <span>נקה הכל</span>
        </button>
      </div>
    </div>
  );
}

async function redrawCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strokes: any[][],
  backgroundImageUrl?: string | null,
  backgroundPadding = 0,
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (backgroundImageUrl) {
    const image = await loadImage(backgroundImageUrl);
    drawContainedImage(ctx, image, width, height, backgroundPadding);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#000000";

  strokes.forEach(stroke => {
    if (!stroke || stroke.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }
    ctx.stroke();
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  padding = 0,
) {
  const drawableWidth = Math.max(1, width - padding * 2);
  const drawableHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(drawableWidth / image.naturalWidth, drawableHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}
