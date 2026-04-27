import { corsResponse, json as jsonResponse } from "../_shared/http.ts";
import type { writeAuditEvent } from "../_shared/audit.ts";
import type {
  StartAttemptFingerprint,
  StartRateLimitDecision,
} from "../_shared/start-rate-limit.ts";

interface StartSessionBody {
  token: string;
  deviceContext?: unknown;
}

interface StartSessionRecord {
  id: string;
  link_token: string;
  status: "pending" | "in_progress";
  link_used_at: string | null;
  age_band: string | null;
  education_years: number | null;
  patient_age_years: number | null;
  moca_version: string | null;
  assessment_language: string | null;
}

type SupabaseClient = any;

export interface StartSessionDeps {
  createSupabaseClient: () => SupabaseClient;
  buildStartAttemptFingerprint: (
    req: Request,
    accessCode: string,
  ) => Promise<StartAttemptFingerprint>;
  checkStartRateLimit: (
    supabase: SupabaseClient,
    fingerprint: StartAttemptFingerprint,
  ) => Promise<StartRateLimitDecision>;
  recordStartAttempt: (
    supabase: SupabaseClient,
    input: {
      fingerprint: StartAttemptFingerprint;
      success: boolean;
      failureReason?: string;
      sessionId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) => Promise<void>;
  writeAuditEvent: typeof writeAuditEvent;
  now: () => string;
}

export async function handleStartSession(
  req: Request,
  deps: StartSessionDeps,
) {
  const json = (body: unknown, status = 200, headers?: HeadersInit) =>
    jsonResponse(body, status, req, headers);
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: StartSessionBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return json({ error: "Missing test number" }, 400);
  const deviceContext = normalizeDeviceContext(body.deviceContext);

  const supabase = deps.createSupabaseClient();
  const fingerprint = await deps.buildStartAttemptFingerprint(req, token);
  const rateLimit = await deps.checkStartRateLimit(supabase, fingerprint);
  if (!rateLimit.allowed) {
    // Avoid extending the active rate-limit window with more failed rows for
    // retries that are already blocked.
    return json(
      { error: "Too many start attempts. Please try again later." },
      429,
      rateLimit.retryAfterSeconds
        ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
        : undefined,
    );
  }

  if (!/^\d{8}$/.test(token)) {
    await deps.recordStartAttempt(supabase, {
      fingerprint,
      success: false,
      failureReason: "invalid_format",
    });
    return json({ error: "Invalid test number" }, 404);
  }

  const { data: sessionData, error } = await supabase
    .from("sessions")
    .select(
      "id, link_token, status, link_used_at, age_band, education_years, patient_age_years, created_at, access_code, moca_version, assessment_language",
    )
    .eq("access_code", token)
    .in("status", ["pending", "in_progress"])
    .single();
  const session = sessionData as StartSessionRecord | null;

  if (error || !session) {
    await deps.recordStartAttempt(supabase, {
      fingerprint,
      success: false,
      failureReason: "invalid_test_number",
    });
    return json({ error: "Invalid test number" }, 404);
  }

  if (
    !Number.isInteger(session.education_years) ||
    !Number.isInteger(session.patient_age_years)
  ) {
    await deps.recordStartAttempt(supabase, {
      fingerprint,
      success: false,
      failureReason: "missing_scoring_context",
      sessionId: session.id,
    });
    return json(
      { error: "Session is missing required clinical scoring context" },
      409,
    );
  }

  if (session.link_used_at) {
    await deps.recordStartAttempt(supabase, {
      fingerprint,
      success: false,
      failureReason: "test_number_already_used",
      sessionId: session.id,
    });
    return json({ error: "Test number already used" }, 410);
  }

  if (session.status === "pending") {
    const { data: startedSession, error: updateError } = await supabase
      .from("sessions")
      .update({
        started_at: deps.now(),
        link_used_at: deps.now(),
        status: "in_progress",
        device_context: deviceContext,
      })
      .eq("id", session.id)
      .eq("status", "pending")
      .is("link_used_at", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return json({ error: "Failed to start session" }, 500);
    }
    if (!startedSession) {
      await deps.recordStartAttempt(supabase, {
        fingerprint,
        success: false,
        failureReason: "test_number_already_used",
        sessionId: session.id,
      });
      return json({ error: "Test number already used" }, 410);
    }

    await deps.writeAuditEvent(supabase, {
      eventType: "session_started",
      sessionId: session.id,
      actorType: "patient",
      metadata: { mocaVersion: session.moca_version, deviceContext },
    });
  }

  await deps.recordStartAttempt(supabase, {
    fingerprint,
    success: true,
    sessionId: session.id,
    metadata: { mocaVersion: session.moca_version },
  });

  return json({
    status: "ready",
    sessionId: session.id,
    linkToken: session.link_token,
    ageBand: session.age_band,
    educationYears: session.education_years,
    patientAge: session.patient_age_years,
    mocaVersion: session.moca_version,
    language: session.assessment_language,
    sessionDate: deps.now(),
  });
}

function normalizeDeviceContext(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  setString(normalized, "userAgent", input.userAgent, 300);
  setString(normalized, "platform", input.platform, 80);
  setString(normalized, "language", input.language, 32);
  setString(normalized, "pointer", input.pointer, 16);
  setString(normalized, "hover", input.hover, 16);
  setStringChoice(normalized, "formFactor", input.formFactor, [
    "phone",
    "tablet",
    "desktop",
  ]);
  setStringChoice(normalized, "orientation", input.orientation, [
    "portrait",
    "landscape",
  ]);
  setStringArray(normalized, "languages", input.languages, 5, 32);
  setInteger(normalized, "screenWidth", input.screenWidth, 10000);
  setInteger(normalized, "screenHeight", input.screenHeight, 10000);
  setInteger(normalized, "viewportWidth", input.viewportWidth, 10000);
  setInteger(normalized, "viewportHeight", input.viewportHeight, 10000);
  setInteger(normalized, "touchPoints", input.touchPoints, 20);
  setNumber(normalized, "devicePixelRatio", input.devicePixelRatio, 10);
  if (typeof input.standalone === "boolean") normalized.standalone = input.standalone;

  return normalized;
}

function setString(target: Record<string, unknown>, key: string, value: unknown, maxLength: number) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed) target[key] = trimmed.slice(0, maxLength);
}

function setStringChoice(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
  choices: readonly string[],
) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (choices.includes(trimmed)) target[key] = trimmed;
}

function setStringArray(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
  maxItems: number,
  maxLength: number,
) {
  if (!Array.isArray(value)) return;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
  if (items.length > 0) target[key] = items;
}

function setInteger(target: Record<string, unknown>, key: string, value: unknown, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  const integer = Math.round(value);
  if (integer >= 0 && integer <= max) target[key] = integer;
}

function setNumber(target: Record<string, unknown>, key: string, value: unknown, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  if (value >= 0 && value <= max) target[key] = Math.round(value * 100) / 100;
}
