import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  title: string;
  isLastStep: boolean;
}

export const AssessmentLayout: React.FC<Props> = ({ children, onNext, onBack, title, isLastStep }) => {
  const { t } = useTranslation();

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{ padding: '20px 0', borderBottom: '2px solid var(--border-color)' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{title}</h1>
      </header>

      <main style={{ flex: 1, padding: '40px 0' }}>
        {children}
      </main>

      <footer style={{ padding: '20px 0', display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
        {onBack && (
          <button className="high-contrast-btn" style={{ background: '#fff', color: '#000' }} onClick={onBack}>
            <ChevronRight size={24} style={{ marginLeft: '8px' }} />
            {t('common.back')}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="high-contrast-btn" onClick={onNext}>
          {isLastStep ? t('common.finish') : t('common.next')}
          <ChevronLeft size={24} style={{ marginRight: '8px' }} />
        </button>
      </footer>
    </div>
  );
};
