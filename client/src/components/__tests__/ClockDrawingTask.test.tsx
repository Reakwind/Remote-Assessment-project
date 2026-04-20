import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClockDrawingTask } from '../ClockDrawingTask';

describe('ClockDrawingTask', () => {
  it('should render 11:10 instruction and toggle photo mode', () => {
    render(<ClockDrawingTask onComplete={vi.fn()} />);
    expect(screen.getByText(/11:10/i)).toBeInTheDocument();
    
    const toggleBtn = screen.getByText(/אני מעדיף לצייר על דף ולצלם/i);
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/צלמו אותו והעלו כאן/i)).toBeInTheDocument();
  });
});
