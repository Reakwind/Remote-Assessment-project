import React, { useState } from 'react';
import { BaseCanvas } from './BaseCanvas';
import '../styles/canvas.css';

interface ClockDrawingTaskProps {
  onComplete: (data: string) => void;
}

export const ClockDrawingTask: React.FC<ClockDrawingTaskProps> = ({ onComplete }) => {
  const [usePhoto, setUsePhoto] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onComplete(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="clock-drawing-container">
      <div className="task-header">
        <h3>מבחן ציור שעון</h3>
        <p className="instruction">ציירו שעון המראה את השעה <strong>11:10</strong></p>
      </div>

      {!usePhoto ? (
        <div className="canvas-section">
          <BaseCanvas onSave={onComplete} />
          <button 
            onClick={() => setUsePhoto(true)} 
            className="text-link-btn"
            style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline' }}
          >
            אני מעדיף לצייר על דף ולצלם
          </button>
        </div>
      ) : (
        <div className="photo-upload-section" style={{ textAlign: 'center', padding: '2rem', border: '2px dashed #ccc', borderRadius: '8px' }}>
          <p>ציירו את השעון על דף חלק, צלמו אותו והעלו כאן:</p>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileUpload}
            style={{ marginTop: '1rem' }}
          />
          <button 
            onClick={() => setUsePhoto(false)} 
            className="secondary-btn"
            style={{ display: 'block', margin: '1rem auto' }}
          >
            חזרה לציור דיגיטלי
          </button>
        </div>
      )}
    </div>
  );
};
