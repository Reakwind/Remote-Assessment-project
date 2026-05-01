// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PatientTaskShell } from './PatientTaskShell';

describe('PatientTaskShell', () => {
  it('shows progress, save state, and navigation actions', async () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(
      <PatientTaskShell
        mocaVersion="8.3"
        currentStep={2}
        totalSteps={12}
        isEndScreen={false}
        hasEvidence={true}
        saveState={{ status: 'error', message: 'offline save failed' }}
        topBanner={<div data-testid="stimulus-banner">stimulus readiness</div>}
        onNext={onNext}
        onBack={onBack}
      >
        <div>cube task</div>
      </PatientTaskShell>,
    );

    expect(screen.getByText('cube task')).toBeInTheDocument();
    expect(screen.getByTestId('patient-step-indicator')).toHaveTextContent('2/12');
    expect(
      screen.getByTestId('stimulus-banner').compareDocumentPosition(screen.getByTestId('patient-progress-bar')),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole('main')).not.toContainElement(screen.getByTestId('stimulus-banner'));
    expect(screen.getByRole('alert')).toHaveTextContent('offline save failed');

    await userEvent.click(screen.getByRole('button', { name: /נסה שוב לשמור/ }));
    expect(onNext).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /חזרה/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
