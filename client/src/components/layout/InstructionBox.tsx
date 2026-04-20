import React from 'react';
import { ListenButton } from './ListenButton';

interface Props {
  title: string;
  steps: string[];
  example?: string;
  onListen?: () => void;
  playing?: boolean;
}

export const InstructionBox: React.FC<Props> = ({ title, steps, example, onListen, playing }) => {
  return (
    <div style={{
      border: '2px solid var(--primary-color)',
      borderRadius: 'var(--r-lg)',
      padding: 'var(--sp-6) var(--sp-7)',
      position: 'relative',
      background: '#fff',
      maxWidth: 900,
      margin: '0 auto',
    }}>
      <div style={{ position: 'absolute', top: 32, left: 36 }}>
        <ListenButton size="lg" onClick={onListen} playing={playing} />
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 700,
        textTransform: 'uppercase',
        color: 'var(--ink-500)',
        marginBottom: 12,
        letterSpacing: '0.14em'
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-color)' }} />
        הוראות
      </div>

      <h3 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>{title}</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div style={{
              width: 32,
              height: 32,
              minWidth: 32,
              borderRadius: '50%',
              background: 'var(--primary-color)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums'
            }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.4 }}>{step}</div>
          </div>
        ))}
      </div>

      {example && (
        <div style={{
          marginTop: 40,
          padding: '16px 24px',
          background: 'var(--ink-50)',
          borderRadius: 'var(--r-md)',
          borderRight: '4px solid var(--primary-color)',
          fontSize: 18,
          fontStyle: 'italic',
        }}>
          <span style={{ fontWeight: 800, fontStyle: 'normal', marginLeft: 8 }}>דוגמה:</span>
          {example}
        </div>
      )}
    </div>
  );
};
