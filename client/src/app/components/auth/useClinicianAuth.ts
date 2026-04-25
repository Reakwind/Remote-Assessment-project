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

export type AuthAssuranceLevel = "aal1" | "aal2" | null;

export interface ClinicianAuthState {
  loading: boolean;
  signedIn: boolean;
  session: Session | null;
  profile: ClinicianProfile | null;
  aal: AuthAssuranceLevel;
  mfaEnrolled: boolean;
  mfaRequired: boolean;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  requiresMfa?: boolean;
}

interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  clinicName: string;
  phoneNumber: string;
}

interface EnrollTotpResult {
  ok: boolean;
  error?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
  uri?: string;
}

interface VerifyTotpResult {
  ok: boolean;
  error?: string;
}

const DEFAULT_AUTH_STATE: ClinicianAuthState = {
  loading: true,
  signedIn: false,
  session: null,
  profile: null,
  aal: null,
  mfaEnrolled: false,
  mfaRequired: false,
};

export function normalizeTotpQrCode(qrCode: string | undefined): string | undefined {
  if (!qrCode) return undefined;

  const commaIndex = qrCode.indexOf(",");
  if (qrCode.startsWith("data:image/svg+xml") && commaIndex >= 0) {
    const prefix = qrCode.slice(0, commaIndex);
    const payload = qrCode.slice(commaIndex + 1);
    if (payload.trimStart().startsWith("<svg")) {
      return `${prefix},${encodeURIComponent(payload)}`;
    }
    return qrCode;
  }

  if (qrCode.trimStart().startsWith("<svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`;
  }

  return qrCode;
}

function clinicianMfaError(error: string | undefined): string {
  if (!error) return "רישום 2FA נכשל.";
  if (error.includes("mfa_totp_enroll_not_enabled") || error.toLowerCase().includes("totp enroll")) {
    return "אימות באמצעות אפליקציה אינו מופעל בסביבת Supabase. יש להפעיל auth.mfa.totp.enroll_enabled ו-auth.mfa.totp.verify_enabled.";
  }
  return error;
}

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

    // MFA state: are any TOTP factors enrolled, and at what assurance level is the session.
    let mfaEnrolled = false;
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      mfaEnrolled = Boolean(
        factorsData?.totp?.some((factor) => factor.status === "verified"),
      );
    } catch {
      mfaEnrolled = false;
    }

    let currentLevel: AuthAssuranceLevel = null;
    let nextLevel: AuthAssuranceLevel = null;
    try {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      currentLevel = (aalData?.currentLevel ?? null) as AuthAssuranceLevel;
      nextLevel = (aalData?.nextLevel ?? null) as AuthAssuranceLevel;
    } catch {
      currentLevel = null;
      nextLevel = null;
    }

    const mfaRequired =
      (mfaEnrolled && currentLevel !== "aal2") ||
      (nextLevel === "aal2" && currentLevel !== "aal2");

    setState({
      loading: false,
      signedIn: true,
      session,
      profile,
      aal: currentLevel,
      mfaEnrolled,
      mfaRequired,
    });
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      await refresh();

      // Peek at MFA state after refresh to advise the caller.
      try {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        const requiresMfa =
          (aalData?.currentLevel ?? null) !== "aal2" &&
          (aalData?.nextLevel === "aal2" ||
            Boolean(
              (await supabase.auth.mfa.listFactors()).data?.totp?.some(
                (f) => f.status === "verified",
              ),
            ));
        return { ok: true, requiresMfa };
      } catch {
        return { ok: true };
      }
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
    if (user) {
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

  const enrollTotp = useCallback(async (): Promise<EnrollTotpResult> => {
    try {
      // Drop any previous unverified factor so the user never hits the
      // "only one unverified factor allowed" 422 on retry. listFactors()
      // exposes verified factors under .totp and every factor (incl.
      // unverified) under .all.
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const stale =
        factorsData?.all?.filter(
          (f) => f.factor_type === "totp" && f.status !== "verified",
        ) ?? [];
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Remote Check · ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error || !data) {
        return { ok: false, error: clinicianMfaError(error?.message) };
      }
      return {
        ok: true,
        factorId: data.id,
        qrCode: normalizeTotpQrCode(data.totp.qr_code),
        secret: data.totp.secret,
        uri: data.totp.uri,
      };
    } catch (err) {
      return { ok: false, error: clinicianMfaError(err instanceof Error ? err.message : undefined) };
    }
  }, []);

  const verifyTotp = useCallback(
    async (factorId: string, code: string): Promise<VerifyTotpResult> => {
      try {
        const { data: challengeData, error: challengeError } =
          await supabase.auth.mfa.challenge({ factorId });
        if (challengeError || !challengeData) {
          return { ok: false, error: challengeError?.message ?? "יצירת אתגר נכשלה." };
        }

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challengeData.id,
          code,
        });
        if (verifyError) {
          return { ok: false, error: verifyError.message };
        }

        await refresh();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "אימות נכשל." };
      }
    },
    [refresh],
  );

  const verifyExistingTotp = useCallback(
    async (code: string): Promise<VerifyTotpResult> => {
      try {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const factor = factorsData?.totp?.find((f) => f.status === "verified");
        if (!factor) {
          return { ok: false, error: "לא נמצא גורם TOTP רשום." };
        }
        return verifyTotp(factor.id, code);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "אימות נכשל." };
      }
    },
    [verifyTotp],
  );

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
    enrollTotp,
    verifyTotp,
    verifyExistingTotp,
  };
}
