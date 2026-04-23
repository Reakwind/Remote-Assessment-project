import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Play, Pause } from "lucide-react";
;

interface Point {
  x: number;
  y: number;
  time: number;
  pressure: number;
  pointerType: string;
}

interface PlaybackCanvasProps {
  strokes: Point[][];
  width?: number;
  height?: number;
  backgroundImageUrl?: string;
}

export function PlaybackCanvas({ strokes, width = 600, height = 400, backgroundImageUrl }: PlaybackCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(1); // 0 to 1
  const progressRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Calculate timing metrics
  const { startTime, totalDuration, validStrokes } = useMemo(() => {
    const valid = (strokes || []).filter(s => s && s.length > 0);
    if (valid.length === 0) {
      return { startTime: 0, totalDuration: 0, validStrokes: [] };
    }
    
    let minT = Infinity;
    let maxT = -Infinity;
    
    valid.forEach(stroke => {
      stroke.forEach(pt => {
        if (pt.time < minT) minT = pt.time;
        if (pt.time > maxT) maxT = pt.time;
      });
    });
    
    return {
      startTime: minT,
      totalDuration: Math.max(0, maxT - minT),
      validStrokes: valid
    };
  }, [strokes]);

  const drawStrokes = useCallback((currentRelativeTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width * dpr, height * dpr);
    ctx.scale(dpr, dpr);
    
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    validStrokes.forEach(stroke => {
      if (stroke.length === 0) return;
      
      const firstPtTime = stroke[0].time - startTime;
      if (firstPtTime > currentRelativeTime) return;

      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      
      for (let i = 1; i < stroke.length; i++) {
        const pt = stroke[i];
        const ptTime = pt.time - startTime;
        
        if (ptTime > currentRelativeTime) break;

        // Dynamic width based on pressure if available
        const lineWidth = pt.pointerType === 'pen' ? Math.max(1, pt.pressure * 5) : 3;
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = pt.pointerType === 'pen' ? '#0047AB' : '#000000'; // Dark blue for pen, black for touch/mouse
        
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    });
    }, [validStrokes, startTime, width, height]);

  // Redraw when progress changes manually or via initial render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    drawStrokes(progress * totalDuration);
  }, [progress, totalDuration, validStrokes, width, height, drawStrokes]);

  // Handle animation frame
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    lastTimeRef.current = performance.now();
    
    const animate = (time: number) => {
      const deltaMs = time - lastTimeRef.current;
      lastTimeRef.current = time;
      
      const prev = progressRef.current;
      let next = totalDuration > 0 ? prev + (deltaMs / totalDuration) : 1;
      
      progressRef.current = next; // Update ref immediately for next frame
      
      if (next >= 1) {
        next = 1;
        progressRef.current = 1;
        setProgress(next);
        setIsPlaying(false);
      } else {
        setProgress(next);
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, totalDuration]);

  const handlePlayPause = () => {
    if (progress >= 1 && !isPlaying) {
      setProgress(0); // restart
    }
    setIsPlaying(!isPlaying);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProgress(parseFloat(e.target.value));
    setIsPlaying(false);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (validStrokes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
        <p className="text-gray-400 font-bold text-lg">אין נתוני ציור להצגה</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div 
        className="relative bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden mb-4 flex items-center justify-center"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {backgroundImageUrl && (
          <img 
            src={backgroundImageUrl} 
            alt="background" 
            className="absolute inset-0 w-full h-full object-contain opacity-40 grayscale pointer-events-none" 
          />
        )}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-10"
          style={{ width: `${width}px`, height: `${height}px` }}
        />
      </div>

      <div className="w-full max-w-[600px] flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <button 
          onClick={handlePlayPause}
          className="w-12 h-12 flex-shrink-0 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
          aria-label={isPlaying ? "השהה ניגון" : "הפעל ניגון"}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
        </button>
        
        <div className="flex-1 flex flex-col gap-1">
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.001" 
            value={progress}
            onChange={handleScrub}
            className="w-full accent-black cursor-pointer"
            aria-label="ציר זמן הציור"
          />
          <div className="flex justify-between text-xs font-mono font-bold text-gray-500">
            <span>{formatTime(progress * totalDuration)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
