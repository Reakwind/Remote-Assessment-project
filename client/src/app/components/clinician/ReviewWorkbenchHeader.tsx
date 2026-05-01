import { ClipboardCheck, FileDown } from "lucide-react";
import type { ReactNode } from "react";

import { StatusPill, type StatusPillValue } from "../StatusPill";

interface ReviewWorkbenchHeaderProps {
  caseLabel?: string | null;
  status: StatusPillValue;
  pendingReviewCount: number;
  totalScore: number | null;
  totalProvisional: boolean;
  canExportPdf: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}

export function ReviewWorkbenchHeader({
  caseLabel,
  status,
  pendingReviewCount,
  totalScore,
  totalProvisional,
  canExportPdf,
  actions,
  children,
}: ReviewWorkbenchHeaderProps) {
  const normalizedCaseLabel = caseLabel?.trim();
  const scoreLabel =
    totalScore == null
      ? "ציון לא זמין"
      : totalProvisional
      ? `ציון זמני ${totalScore}/30`
      : `ציון ${totalScore}/30`;
  const pdfLabel = canExportPdf ? "PDF מוכן לייצוא" : "PDF זמין לאחר סיום סקירה";

  return (
    <section className="mb-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="break-words text-2xl font-extrabold leading-tight text-black">
              {normalizedCaseLabel ? `תיק ${normalizedCaseLabel}` : "תיק"}
            </h1>
            <StatusPill status={status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-600">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-amber-900">
              <ClipboardCheck className="h-4 w-4" />
              {pendingReviewCount} פריטים ממתינים לסקירה
            </span>
            <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-900">{scoreLabel}</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-gray-900">
              <FileDown className="h-4 w-4" />
              {pdfLabel}
            </span>
          </div>
        </div>

        {(actions ?? children) && (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {actions ?? children}
          </div>
        )}
      </div>
    </section>
  );
}
