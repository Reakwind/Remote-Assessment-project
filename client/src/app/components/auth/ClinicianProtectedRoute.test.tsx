// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicianProtectedRoute } from './ClinicianProtectedRoute';
import { useClinicianAuth } from './useClinicianAuth';

vi.mock('./useClinicianAuth', () => ({
  useClinicianAuth: vi.fn(),
}));

const mockedUseClinicianAuth = vi.mocked(useClinicianAuth);
type UseClinicianAuthResult = ReturnType<typeof useClinicianAuth>;

function authState(overrides: Partial<UseClinicianAuthResult>): UseClinicianAuthResult {
  return {
    loading: false,
    signedIn: false,
    session: null,
    profile: null,
    refresh: vi.fn(async () => {}),
    signIn: vi.fn(async () => ({ ok: true })),
    signUp: vi.fn(async () => ({ ok: true })),
    signOut: vi.fn(async () => {}),
    ...overrides,
  } as UseClinicianAuthResult;
}

function renderWithRouter(initialPath = '/dashboard') {
  const router = createMemoryRouter(
    [
      {
        path: '/dashboard',
        element: <ClinicianProtectedRoute />,
        children: [{ index: true, element: <div>Dashboard content</div> }],
      },
      {
        path: '/clinician/auth',
        element: <div>Clinician auth page</div>,
      },
    ],
    { initialEntries: [initialPath] },
  );

  render(<RouterProvider router={router} />);
  return router;
}

describe('ClinicianProtectedRoute', () => {
  beforeEach(() => {
    mockedUseClinicianAuth.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a loading state while auth status is resolving', () => {
    mockedUseClinicianAuth.mockReturnValue(authState({ loading: true }));

    renderWithRouter();

    expect(screen.getByText('טוען פרטי משתמש...')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to the clinician auth page and preserves source path', async () => {
    mockedUseClinicianAuth.mockReturnValue(authState({ signedIn: false }));

    const router = renderWithRouter('/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Clinician auth page')).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/clinician/auth');
    expect(router.state.location.state).toEqual({ from: '/dashboard' });
  });

  it('renders protected children for signed-in clinicians', () => {
    mockedUseClinicianAuth.mockReturnValue(authState({ signedIn: true }));

    const router = renderWithRouter();

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
  });
});
