import { AlertTriangle, CheckCircle2, Clock3, Circle, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

export type StatusPillValue = "new" | "pending" | "in_progress" | "review" | "awaiting_review" | "completed";

const STATUS_CONFIG: Record<
  StatusPillValue,
  { label: string; className: string; Icon: LucideIcon }
> = {
  new: {
    label: "חדש",
    className: "bg-gray-100 text-gray-800",
    Icon: Circle,
  },
  pending: {
    label: "טרם החל",
    className: "bg-gray-100 text-gray-800",
    Icon: Clock3,
  },
  in_progress: {
    label: "בתהליך",
    className: "bg-blue-100 text-blue-800",
    Icon: Clock3,
  },
  review: {
    label: "דורש סקירה",
    className: "bg-amber-100 text-amber-900",
    Icon: AlertTriangle,
  },
  awaiting_review: {
    label: "ממתין לסקירה",
    className: "bg-amber-100 text-amber-900",
    Icon: AlertTriangle,
  },
  completed: {
    label: "הושלם",
    className: "bg-green-100 text-green-800",
    Icon: CheckCircle2,
  },
};

export function StatusPill({
  status,
  className,
  label,
}: {
  status: StatusPillValue;
  className?: string;
  label?: string;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.Icon;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold",
        config.className,
        className,
      )}
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>{label ?? config.label}</span>
    </span>
  );
}
