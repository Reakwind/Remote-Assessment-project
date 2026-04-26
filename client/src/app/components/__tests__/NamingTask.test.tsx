// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NamingTask } from '../NamingTask';

const updateTaskData = vi.fn();

vi.mock('../../store/AssessmentContext', () => ({
  useAssessmentStore: () => ({
    state: {
      scoringContext: { mocaVersion: '8.3' },
      tasks: {},
    },
    updateTaskData,
  }),
}));

vi.mock('../StimuliManifestProvider', () => ({
  DevStimulusNotice: () => <div>stimulus placeholder</div>,
  useStimuliManifest: () => ({
    getAsset: () => null,
  }),
}));

vi.mock('../ListenButton', () => ({
  ListenButton: () => <button type="button">השמע הוראות</button>,
}));

describe('NamingTask', () => {
  afterEach(() => {
    cleanup();
    updateTaskData.mockClear();
  });

  it('confirms the selected answer without revealing correctness', async () => {
    render(<NamingTask />);

    await userEvent.click(screen.getByRole('button', { name: 'חמור' }));

    expect(screen.getByRole('button', { name: /חמור/ })).toHaveTextContent('נבחר');
    expect(screen.getByRole('button', { name: 'סוס' })).not.toHaveTextContent('נבחר');
    expect(screen.queryByText(/נכון|שגוי/)).not.toBeInTheDocument();
    expect(updateTaskData).toHaveBeenCalledWith('naming', {
      answers: { 'item-1': 'חמור' },
    });
  });
});
