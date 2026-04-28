import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

export interface ClinicianProfile {
  id: string;
  email: string;
  full_name: string;
  clinic_name: string | null;
  phone: string | null;
}

export interface ClinicianAuthState {
  loading: boolean;
  signedIn: boolean;
  session: Session | null;
  profile: ClinicianProfile | null;
}

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  clinicName: string;
  phoneNumber: string;
}

const DEFAULT_AUTH_STATE: ClinicianAuthState = {
  loading: true,
  signedIn: false,
  session: null,
  profile: null,
};

export function useClinicianAuth() {
  const [state, setState] = useState<ClinicianAuthState>(DEFAULT_AUTH_STATE);

  const fetchProfile = useCallback(async (userId: string, fallbackEmail: string | undefined) => {
    const { data: profile } = await supabase
      .from("clinicians")
      .select("id, email, full_name, clinic_name, phone")
      .eq("id", userId)
      .maybeSingle();

    if (profile) return profile;

    return {
      id: userId,
      email: fallbackEmail ?? "",
      full_name: fallbackEmail ?? "Clinician",
      clinic_name: null,
      phone: null,
    } satisfies ClinicianProfile;
  }, []);

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setState({ ...DEFAULT_AUTH_STATE, loading: false });
      return;
    }

    const profile = await fetchProfile(session.user.id, session.user.email);

    setState({
      loading: false,
      signedIn: true,
      session,
      profile,
    });
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      await refresh();
      return { ok: true };
    },
    [refresh],
  );

  const signUp = useCallback(async (payload: SignUpPayload): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
          clinic_name: payload.clinicName,
          phone: payload.phoneNumber,
        },
      },
    });
    if (error) return { ok: false, error: error.message };

    const user = data.user;
    if (user && data.session) {
      const { error: profileError } = await supabase.from("clinicians").upsert(
        {
          id: user.id,
          email: payload.email,
          full_name: payload.fullName,
          clinic_name: payload.clinicName,
          phone: payload.phoneNumber,
        },
        { onConflict: "id" },
      );
      if (profileError) return { ok: false, error: profileError.message };
    }

    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ ...DEFAULT_AUTH_STATE, loading: false });
  }, []);

  useEffect(() => {
    const initialRefreshTimer = setTimeout(() => {
      void refresh();
    }, 0);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        void refresh();
      }, 0);
    });

    return () => {
      clearTimeout(initialRefreshTimer);
      subscription.unsubscribe();
    };
  }, [refresh]);

  return {
    ...state,
    refresh,
    signIn,
    signUp,
    signOut,
  };
}
