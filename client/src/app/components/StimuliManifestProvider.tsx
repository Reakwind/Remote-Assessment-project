/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { edgeFn, edgeHeaders } from "../../lib/supabase";
import { useAssessmentStore } from "../store/AssessmentContext";

export interface StimulusAsset {
  taskType: string;
  assetId: string;
  label: string;
  kind: "image" | "audio" | "pdf";
  contentType: string;
  required: boolean;
  storagePath: string;
  available: boolean;
  signedUrl: string | null;
  missingReason: string | null;
}

interface StimuliManifest {
  sessionId: string;
  mocaVersion: string;
  bucket: string;
  expiresInSeconds: number;
  clinicalReady: boolean;
  missingRequiredCount: number;
  assets: StimulusAsset[];
}

interface StimuliManifestContextValue {
  manifest: StimuliManifest | null;
  isLoading: boolean;
  error: string | null;
  getAsset: (taskType: string, assetId: string) => StimulusAsset | null;
}

const StimuliManifestContext = createContext<StimuliManifestContextValue | null>(null);

export function StimuliManifestProvider({ children }: { children: ReactNode }) {
  const { state } = useAssessmentStore();
  const [manifest, setManifest] = useState<StimuliManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasSession = Boolean(state.id && state.linkToken);

  useEffect(() => {
    if (!state.id || !state.linkToken) return;

    let cancelled = false;
    fetch(edgeFn("get-stimuli"), {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({
        sessionId: state.id,
        linkToken: state.linkToken,
      }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load stimulus manifest");
        }
        return data as StimuliManifest;
      })
      .then((data) => {
        if (!cancelled) {
          setError(null);
          setManifest(data);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setManifest(null);
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load stimulus manifest");
        }
      })

    return () => {
      cancelled = true;
    };
  }, [state.id, state.linkToken]);

  const contextValue = useMemo<StimuliManifestContextValue>(() => ({
    manifest: hasSession ? manifest : null,
    isLoading: false,
    error: hasSession ? error : null,
    getAsset: (taskType: string, assetId: string) =>
      hasSession
        ? manifest?.assets.find((asset) => asset.taskType === taskType && asset.assetId === assetId) ?? null
        : null,
  }), [manifest, error, hasSession]);

  return (
    <StimuliManifestContext.Provider value={contextValue}>
      {children}
    </StimuliManifestContext.Provider>
  );
}

export function useStimuliManifest() {
  const value = useContext(StimuliManifestContext);
  if (!value) {
    throw new Error("useStimuliManifest must be used within StimuliManifestProvider");
  }
  return value;
}

export function StimulusReadinessBanner() {
  const { manifest, isLoading, error } = useStimuliManifest();
  const missingRequiredAssets = manifest?.assets.filter((asset) => asset.required && !asset.available) ?? [];
  const hasMissingVisualAsset = missingRequiredAssets.some((asset) => asset.kind !== "audio");

  if (isLoading) return null;
  // Audio prompt gaps are surfaced on the task that needs them; keep the global banner for missing visual stimuli/load failures.
  if (!error && (!manifest || manifest.clinicalReady || !hasMissingVisualAsset)) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6 lg:px-10 text-amber-950">
      <div className="mx-auto flex max-w-[1100px] items-center gap-3 text-sm font-semibold">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>
          גרסת פיתוח: חסרים נכסי מבדק מורשים. מוצגים מצייני מקום לא קליניים.
        </span>
      </div>
    </div>
  );
}

export function DevStimulusNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 ${className}`}
    >
      מציין מקום לפיתוח בלבד. יש להעלות נכס MoCA מורשה לפני שימוש קליני.
    </div>
  );
}
