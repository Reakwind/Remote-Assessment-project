// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClinicianWorkQueue } from './ClinicianWorkQueue';

describe('ClinicianWorkQueue', () => {
  it('shows queue counts and emits selected status', async () => {
    const onChange = vi.fn();
    render(
      <ClinicianWorkQueue
        value="all"
        summary={{ all: 5, new: 1, in_progress: 1, review: 2, completed: 1 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: /כל התיקים\s+5/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ממתינים לסקירה\s+2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /בתהליך\s+1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /טרם החל\s+1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /הושלמו\s+1/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /ממתינים לסקירה\s+2/ }));
    expect(onChange).toHaveBeenCalledWith('review');
  });
});
