/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useEffect, useState } from "react";
import { clsx } from "clsx";

export function BaseCanvas({ 
  width = 800, 
  height = 500, 
  onDrawChange,
  onSave,
  initialStrokes = [],
  backgroundImageUrl,
}: { 
  width?: number; 
  height?: number;
  onDrawChange?: (strokes: any[]) => void;
  onSave?: (dataUrl: string, strokes: any[][]) => void;
  initialStrokes?: any[][];
  backgroundImageUrl?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [strokes, setStrokes] = useState<any[][]>(initialStrokes);
  const currentStrokeRef = useRef<any[]>([]);
  const [stylusOnly, setStylusOnly] = useState(false);

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

    redrawCanvas(ctx, width, height, initialStrokes, backgroundImageUrl).catch((error) => {
      if (!cancelled) console.error("Failed to draw canvas background:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [width, height, initialStrokes, backgroundImageUrl]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stylusOnly && e.pointerType === "touch") return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use setPointerCapture to ensure dragging outside canvas continues drawing
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    
    const newPoint = { x, y, time: Date.now(), pressure: e.pressure || 0.5, pointerType: e.pointerType };
    currentStrokeRef.current = [newPoint];
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    if (stylusOnly && e.pointerType === "touch") return;

    // Use requestAnimationFrame to optimize heavy drawing events
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ctx.lineTo(x, y);
      ctx.stroke();
      
      const newPoint = { x, y, time: Date.now(), pressure: e.pressure || 0.5, pointerType: e.pointerType };
      currentStrokeRef.current.push(newPoint);
    });
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    
    if (currentStrokeRef.current.length > 0) {
      const newStrokes = [...strokes, currentStrokeRef.current];
      setStrokes(newStrokes);
      if (onDrawChange) onDrawChange(newStrokes);
      if (onSave && canvas) onSave(canvas.toDataURL(), newStrokes);
    }
    currentStrokeRef.current = [];
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    redrawCanvas(ctx, width, height, [], backgroundImageUrl).catch((error) => {
      console.error("Failed to clear canvas background:", error);
    });
    setStrokes([]);
    if (onDrawChange) onDrawChange([]);
    if (onSave) onSave("", []);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    if (onDrawChange) onDrawChange(newStrokes);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    redrawCanvas(ctx, width, height, newStrokes, backgroundImageUrl).catch((error) => {
      console.error("Failed to undo canvas stroke:", error);
    });

    if (onSave) onSave(canvas.toDataURL(), newStrokes);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex justify-between items-center w-full px-2">
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="stylus-only" 
            checked={stylusOnly} 
            onChange={(e) => setStylusOnly(e.target.checked)}
            className="w-5 h-5 accent-black cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50"
          />
          <label htmlFor="stylus-only" className="text-gray-700 font-medium cursor-pointer select-none">
            התעלם ממגע (עט חכם בלבד)
          </label>
        </div>
      </div>

      <div className="relative border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm touch-none bg-white focus-within:ring-4 focus-within:ring-blue-600 focus-within:ring-opacity-50 transition-all">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="אזור לציור"
          tabIndex={0}
          className="outline-none"
          style={{ width: `${width}px`, height: `${height}px`, cursor: "crosshair" }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerOut={stopDrawing}
        />
      </div>
      
      <div className="flex gap-4">
        <button 
          onClick={handleUndo} 
          disabled={strokes.length === 0}
          className={clsx(
            "px-6 py-3 rounded-lg font-bold text-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50",
            strokes.length === 0 
              ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed" 
              : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100"
          )}
        >
          בטל פעולה (Undo)
        </button>
        <button 
          onClick={handleClear}
          disabled={strokes.length === 0}
          className={clsx(
            "px-6 py-3 rounded-lg font-bold text-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50",
            strokes.length === 0 
              ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed" 
              : "border-gray-300 text-red-600 bg-white hover:bg-red-50 hover:border-red-200 active:bg-red-100"
          )}
        >
          נקה הכל (Clear)
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
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (backgroundImageUrl) {
    const image = await loadImage(backgroundImageUrl);
    drawContainedImage(ctx, image, width, height);
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
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}
