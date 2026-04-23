// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ClinicianProtectedRoute } from './ClinicianProtectedRoute';
import { useClinicianAuth } from './useClinicianAuth';

vi.mock('./useClinicianAuth', () => ({
  useClinicianAuth: vi.fn(),
}));

const mockedUseClinicianAuth = vi.mocked(useClinicianAuth);

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

  it('shows a loading state while auth status is resolving', () => {
    mockedUseClinicianAuth.mockReturnValue({
      loading: true,
      signedIn: false,
    } as ReturnType<typeof useClinicianAuth>);

    renderWithRouter();

    expect(screen.getByText('טוען פרטי משתמש...')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to the clinician auth page and preserves source path', async () => {
    mockedUseClinicianAuth.mockReturnValue({
      loading: false,
      signedIn: false,
    } as ReturnType<typeof useClinicianAuth>);

    const router = renderWithRouter('/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Clinician auth page')).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/clinician/auth');
    expect(router.state.location.state).toEqual({ from: '/dashboard' });
  });

  it('renders protected children for signed-in clinicians', () => {
    mockedUseClinicianAuth.mockReturnValue({
      loading: false,
      signedIn: true,
    } as ReturnType<typeof useClinicianAuth>);

    renderWithRouter();

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(screen.queryByText('Clinician auth page')).not.toBeInTheDocument();
  });
});
