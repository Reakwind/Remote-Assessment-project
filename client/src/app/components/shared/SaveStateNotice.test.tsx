// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SaveStateNotice } from './SaveStateNotice';

describe('SaveStateNotice', () => {
  it('renders saving state as status', () => {
    render(<SaveStateNotice state={{ status: 'saving' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('שומר תשובה');
  });

  it('renders retryable error as alert with action text', () => {
    render(<SaveStateNotice state={{ status: 'error', message: 'offline save failed' }} actionLabel="נסה שוב" />);
    expect(screen.getByRole('alert')).toHaveTextContent('offline save failed');
    expect(screen.getByText('נסה שוב')).toBeInTheDocument();
  });

  it('renders nothing when state is missing', () => {
    const { container } = render(<SaveStateNotice state={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
