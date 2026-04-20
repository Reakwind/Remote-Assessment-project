import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TrailMakingTask } from '../TrailMakingTask';

describe('TrailMakingTask', () => {
  it('should render all Hebrew and numeric stimuli', () => {
    render(<TrailMakingTask onComplete={vi.fn()} />);
    ['1', 'א', '2', 'ב', '3'].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
