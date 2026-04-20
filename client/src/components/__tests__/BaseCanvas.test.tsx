import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BaseCanvas } from '../BaseCanvas';

describe('BaseCanvas', () => {
  it('should render the canvas and control buttons', () => {
    render(<BaseCanvas onSave={vi.fn()} />);
    // Hebrew labels from the design
    expect(screen.getByRole('button', { name: /ביטול פעולה/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /נקה הכל/i })).toBeInTheDocument();
  });
});
