// @vitest-environment jsdom

import { cleanup, renderHook, act } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useClinicianAuth } from './useClinicianAuth';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    },
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase);
const signUpMock = mockSupabase.auth.signUp as unknown as Mock;
const fromMock = mockSupabase.from as unknown as Mock;

const payload = {
  email: 'new.clinician@example.com',
  password: 'secure-password',
  fullName: 'New Clinician',
  clinicName: 'Memory Clinic',
  phoneNumber: '+972501234567',
};

describe('useClinicianAuth signup', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not write a clinician profile from the browser when signup returns no session', async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: 'clinician-1' }, session: null },
      error: null,
    });

    const { result } = renderHook(() => useClinicianAuth());

    let signupResult: Awaited<ReturnType<typeof result.current.signUp>> | undefined;
    await act(async () => {
      signupResult = await result.current.signUp(payload);
    });

    expect(signupResult).toEqual({ ok: true });
    expect(mockSupabase.from).not.toHaveBeenCalledWith('clinicians');
  });

  it('keeps the browser profile upsert for immediate-session signup', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    fromMock.mockReturnValue({ upsert });
    signUpMock.mockResolvedValue({
      data: {
        user: { id: 'clinician-1' },
        session: { user: { id: 'clinician-1', email: payload.email } } as Session,
      },
      error: null,
    });

    const { result } = renderHook(() => useClinicianAuth());

    let signupResult: Awaited<ReturnType<typeof result.current.signUp>> | undefined;
    await act(async () => {
      signupResult = await result.current.signUp(payload);
    });

    expect(signupResult).toEqual({ ok: true });
    expect(mockSupabase.from).toHaveBeenCalledWith('clinicians');
    expect(upsert).toHaveBeenCalledWith(
      {
        id: 'clinician-1',
        email: payload.email,
        full_name: payload.fullName,
        clinic_name: payload.clinicName,
        phone: payload.phoneNumber,
      },
      { onConflict: 'id' },
    );
  });
});
