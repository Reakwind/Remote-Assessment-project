import React from 'react';
import { BaseCanvas } from './BaseCanvas';
import '../styles/canvas.css';

interface Stimulus {
  id: string;
  label: string;
  x: number;
  y: number;
}

const STIMULI: Stimulus[] = [
  { id: '1', label: '1', x: 100, y: 100 },
  { id: 'א', label: 'א', x: 200, y: 50 },
  { id: '2', label: '2', x: 300, y: 150 },
  { id: 'ב', label: 'ב', x: 150, y: 250 },
  { id: '3', label: '3', x: 400, y: 300 },
];

interface TrailMakingTaskProps {
  onComplete: (dataUrl: string) => void;
}

export const TrailMakingTask: React.FC<TrailMakingTaskProps> = ({ onComplete }) => {
  return (
    <div className="trail-making-container" style={{ position: 'relative' }}>
      <BaseCanvas onSave={onComplete} />
      {STIMULI.map((s) => (
        <div
          key={s.id}
          className="stimulus-circle"
          style={{
            left: s.x,
            top: s.y,
          }}
        >
          {s.label}
        </div>
      ))}
    </div>
  );
};
