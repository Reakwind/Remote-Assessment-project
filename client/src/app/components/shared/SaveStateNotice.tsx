import { AlertTriangle, CheckCircle2, CircleSlash2, Clock3, Loader2, WifiOff } from "lucide-react";
import { clsx } from "clsx";
import type { TaskSaveStatus } from "../../store/AssessmentContext";

type AdditionalSaveState = {
  status: "queued" | "offline" | "blocked";
  message?: string;
};

export type ExtendedSaveState = TaskSaveStatus | AdditionalSaveState;

interface SaveStateNoticeProps {
  state?: ExtendedSaveState;
  actionLabel?: string;
  className?: string;
}

const SAVE_STATE_LABELS: Record<ExtendedSaveState["status"], string> = {
  saving: "שומר תשובה...",
  saved: "נשמר",
  error: "שמירה נכשלה",
  queued: "ממתין לשליחה",
  offline: "אין חיבור רשת",
  blocked: "לא ניתן להמשיך עדיין",
};

const SAVE_STATE_STYLES: Record<ExtendedSaveState["status"], string> = {
  saving: "text-blue-900",
  saved: "text-green-900",
  error: "text-red-900",
  queued: "text-amber-900",
  offline: "text-orange-900",
  blocked: "text-slate-900",
};

const SAVE_STATE_ICON_STYLES: Record<ExtendedSaveState["status"], string> = {
  saving: "text-blue-700",
  saved: "text-green-700",
  error: "text-red-700",
  queued: "text-amber-700",
  offline: "text-orange-700",
  blocked: "text-slate-700",
};

function SaveStateIcon({ status }: { status: ExtendedSaveState["status"] }) {
  const iconClassName = clsx("h-5 w-5 shrink-0", SAVE_STATE_ICON_STYLES[status]);

  if (status === "saving") {
    return <Loader2 className={clsx(iconClassName, "animate-spin")} aria-hidden="true" />;
  }

  if (status === "saved") {
    return <CheckCircle2 className={iconClassName} aria-hidden="true" />;
  }

  if (status === "queued") {
    return <Clock3 className={iconClassName} aria-hidden="true" />;
  }

  if (status === "offline") {
    return <WifiOff className={iconClassName} aria-hidden="true" />;
  }

  if (status === "blocked") {
    return <CircleSlash2 className={iconClassName} aria-hidden="true" />;
  }

  return <AlertTriangle className={iconClassName} aria-hidden="true" />;
}

export function SaveStateNotice({ state, actionLabel, className }: SaveStateNoticeProps) {
  if (!state) {
    return null;
  }

  const role = state.status === "error" || state.status === "offline" || state.status === "blocked" ? "alert" : "status";
  const message = state.message ?? SAVE_STATE_LABELS[state.status];

  return (
    <div
      className={clsx(
        "inline-flex min-h-9 max-w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-extrabold sm:justify-end",
        SAVE_STATE_STYLES[state.status],
        className,
      )}
      role={role}
    >
      <SaveStateIcon status={state.status} />
      <span className="min-w-0 truncate">{message}</span>
      {actionLabel && (
        <span className="shrink-0 rounded-md border border-current/20 px-2 py-0.5 text-xs font-bold">
          {actionLabel}
        </span>
      )}
    </div>
  );
}
