# Frontend Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first frontend readiness slices for patient PWA usability, clinician operations workflow, and shared frontend state/style structure.

**Architecture:** Keep the current route and backend contracts intact. Extract small shared state/display components from the current large patient and clinician screens, then use those components to make save/retry, task shell, work queue, review, and export states consistent. Avoid a broad refactor before pilot-critical flows are clearer.

**Tech Stack:** React 19, React Router hash routes, Vite, Tailwind CSS v4, Vitest, Testing Library, Playwright, Supabase client and Edge Function fetch helpers.

---

## File Structure

- Create `client/src/app/components/shared/SaveStateNotice.tsx`: shared visible state for saving, saved, retryable error, queued, offline, and blocked continuation.
- Create `client/src/app/components/shared/SaveStateNotice.test.tsx`: focused state rendering tests.
- Create `client/src/app/components/patient/PatientTaskShell.tsx`: patient task page chrome: header, progress, main slot, validation/save state, and navigation.
- Create `client/src/app/components/patient/patientTaskFlow.ts`: step metadata and task evidence checks currently embedded in `AssessmentLayout.tsx`.
- Create `client/src/app/components/patient/PatientTaskShell.test.tsx`: shell behavior tests.
- Modify `client/src/app/components/AssessmentLayout.tsx`: delegate shell rendering and flow metadata to patient files.
- Modify `client/src/app/components/BaseCanvas.tsx`: expose drawing status affordances without changing drawing data contract.
- Create `client/src/app/components/clinician/clinicianQueue.ts`: pure case/session derivation helpers for work queues and status counts.
- Create `client/src/app/components/clinician/clinicianQueue.test.ts`: queue derivation tests.
- Create `client/src/app/components/clinician/ClinicianWorkQueue.tsx`: dashboard work queue controls and summary.
- Create `client/src/app/components/clinician/ClinicianWorkQueue.test.tsx`: queue UI tests.
- Modify `client/src/app/components/ClinicianDashboardList.tsx`: use work queue helpers and component.
- Create `client/src/app/components/clinician/ReviewWorkbenchHeader.tsx`: compact review state, pending count, finalization/export affordance area for session detail.
- Create `client/src/app/components/clinician/ReviewWorkbenchHeader.test.tsx`: workbench header tests.
- Modify `client/src/app/components/ClinicianDashboardDetail.tsx`: add the header without changing review update contracts.
- Modify `client/src/styles/index.css`: add documented CSS custom properties for patient and clinician density.
- Create `docs/FRONTEND_READINESS.md`: implementation-facing frontend readiness guide.
- Modify `AGENTS.md`, `docs/PATIENT_PWA_ARCHITECTURE.md`, `docs/PATIENT_PWA_TRACKER.md`, and `JOURNEY.md`: link the frontend readiness guide and record meaningful journey changes.

## Task 1: Add Shared Save State Notice

**Files:**
- Create: `client/src/app/components/shared/SaveStateNotice.tsx`
- Create: `client/src/app/components/shared/SaveStateNotice.test.tsx`
- Test: `client/src/app/components/shared/SaveStateNotice.test.tsx`

- [ ] **Step 1: Write failing render tests**

Create `client/src/app/components/shared/SaveStateNotice.test.tsx`:

```tsx
// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SaveStateNotice } from './SaveStateNotice';

describe('SaveStateNotice', () => {
  it('renders saving state as status', () => {
    render(<SaveStateNotice state={{ status: 'saving' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('שומר תשובה');
  });

  it('renders retryable error as alert with action text', () => {
    render(<SaveStateNotice state={{ status: 'error', message: 'offline save failed' }} actionLabel="נסה שוב" />);
    expect(screen.getByRole('alert')).toHaveTextContent('offline save failed');
    expect(screen.getByText('נסה שוב')).toBeInTheDocument();
  });

  it('renders nothing when state is missing', () => {
    const { container } = render(<SaveStateNotice state={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd client
npm test -- SaveStateNotice.test.tsx
```

Expected: fail because `SaveStateNotice` does not exist.

- [ ] **Step 3: Implement the shared component**

Create `client/src/app/components/shared/SaveStateNotice.tsx`:

```tsx
import { AlertTriangle, CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import type { TaskSaveStatus } from '../../store/AssessmentContext';

type ExtendedSaveState = TaskSaveStatus | { status: 'queued' | 'offline' | 'blocked'; message?: string };

interface SaveStateNoticeProps {
  state?: ExtendedSaveState;
  actionLabel?: string;
  className?: string;
}

const LABELS: Record<ExtendedSaveState['status'], string> = {
  saving: 'שומר תשובה...',
  saved: 'נשמר',
  error: 'שמירה נכשלה',
  queued: 'ממתין לשליחה',
  offline: 'אין חיבור רשת',
  blocked: 'לא ניתן להמשיך עדיין',
};

export function SaveStateNotice({ state, actionLabel, className }: SaveStateNoticeProps) {
  if (!state) return null;
  const isError = state.status === 'error' || state.status === 'offline' || state.status === 'blocked';
  const Icon =
    state.status === 'saving'
      ? Loader2
      : state.status === 'saved'
        ? CheckCircle2
        : state.status === 'offline'
          ? WifiOff
          : AlertTriangle;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={clsx(
        'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-extrabold',
        state.status === 'saved' && 'bg-green-50 text-green-900',
        state.status === 'saving' && 'bg-blue-50 text-blue-900',
        state.status === 'queued' && 'bg-amber-50 text-amber-900',
        isError && 'bg-red-50 text-red-900',
        className,
      )}
    >
      <Icon className={clsx('h-5 w-5', state.status === 'saving' && 'animate-spin')} />
      <span>{state.message ?? LABELS[state.status]}</span>
      {actionLabel && <span className="rounded-md bg-white/70 px-2 py-0.5 text-xs">{actionLabel}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run focused test**

Run:

```bash
cd client
npm test -- SaveStateNotice.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/app/components/shared/SaveStateNotice.tsx client/src/app/components/shared/SaveStateNotice.test.tsx
git commit -m "Add shared save state notice"
```

## Task 2: Extract Patient Task Flow Metadata

**Files:**
- Create: `client/src/app/components/patient/patientTaskFlow.ts`
- Modify: `client/src/app/components/AssessmentLayout.tsx`
- Create: `client/src/app/components/patient/patientTaskFlow.test.ts`

- [ ] **Step 1: Write failing metadata tests**

Create `client/src/app/components/patient/patientTaskFlow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getPatientStepConfig, patientTaskHasEvidence, patientTaskTotalSteps } from './patientTaskFlow';

describe('patientTaskFlow', () => {
  it('resolves cube task step metadata', () => {
    expect(getPatientStepConfig('/patient/cube')).toMatchObject({
      step: 2,
      next: '/patient/clock',
      prev: '/patient/trail-making',
      taskKey: 'cube',
    });
  });

  it('detects drawing stroke evidence', () => {
    expect(patientTaskHasEvidence('cube', { cube: { strokes: [[{ x: 1, y: 2 }]] } })).toBe(true);
    expect(patientTaskHasEvidence('cube', { cube: { strokes: [] } })).toBe(false);
  });

  it('keeps total step count stable', () => {
    expect(patientTaskTotalSteps).toBe(12);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd client
npm test -- patientTaskFlow.test.ts
```

Expected: fail because `patientTaskFlow` does not exist.

- [ ] **Step 3: Move flow metadata into `patientTaskFlow.ts`**

Create `client/src/app/components/patient/patientTaskFlow.ts` by moving the current `TaskKey`, `StepConfig`, `STEP_CONFIG`, `totalSteps`, `hasStrokeEvidence`, `hasAudioEvidence`, and `taskHasEvidence` logic out of `AssessmentLayout.tsx`. Export:

```ts
export type PatientTaskKey = 'trailMaking' | 'cube' | 'clock' | 'naming' | 'memory' | 'digitSpan' | 'vigilance' | 'serial7' | 'language' | 'abstraction' | 'delayedRecall' | 'orientation';

export interface PatientStepConfig {
  step: number;
  next: string;
  prev: string;
  taskKey?: PatientTaskKey;
  incompleteMessage?: string;
}

export const patientTaskTotalSteps = 12;

export function getPatientStepConfig(pathname: string): PatientStepConfig {
  const currentPath = pathname.split('/').pop() ?? 'patient';
  return STEP_CONFIG[currentPath] ?? STEP_CONFIG.patient;
}

export function patientTaskHasEvidence(taskKey: PatientTaskKey | undefined, tasks: Record<string, unknown>): boolean {
  return taskHasEvidence(taskKey, tasks);
}
```

Keep `STEP_CONFIG` internal unless another component needs it.

- [ ] **Step 4: Update `AssessmentLayout.tsx` imports and usage**

Remove local metadata definitions from `AssessmentLayout.tsx` and import:

```tsx
import {
  getPatientStepConfig,
  patientTaskHasEvidence,
  patientTaskTotalSteps,
} from './patient/patientTaskFlow';
```

Replace local values:

```tsx
const currentStepConfig = getPatientStepConfig(location.pathname);
const currentStep = currentStepConfig.step;
const hasEvidence = useMemo(
  () => patientTaskHasEvidence(currentStepConfig.taskKey, state.tasks),
  [currentStepConfig.taskKey, state.tasks],
);
const progressPercent = (Math.min(currentStep, patientTaskTotalSteps) / patientTaskTotalSteps) * 100;
```

Replace visible total step references with `patientTaskTotalSteps`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd client
npm test -- patientTaskFlow.test.ts AssessmentLayout.test.tsx
```

Expected: both test files pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/app/components/patient/patientTaskFlow.ts client/src/app/components/patient/patientTaskFlow.test.ts client/src/app/components/AssessmentLayout.tsx
git commit -m "Extract patient task flow metadata"
```

## Task 3: Extract Patient Task Shell And Use Shared Save State

**Files:**
- Create: `client/src/app/components/patient/PatientTaskShell.tsx`
- Create: `client/src/app/components/patient/PatientTaskShell.test.tsx`
- Modify: `client/src/app/components/AssessmentLayout.tsx`
- Modify: `client/src/app/components/__tests__/AssessmentLayout.test.tsx`

- [ ] **Step 1: Write failing shell behavior test**

Create `client/src/app/components/patient/PatientTaskShell.test.tsx`:

```tsx
// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PatientTaskShell } from './PatientTaskShell';

describe('PatientTaskShell', () => {
  it('shows progress, save state, and navigation actions', async () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(
      <PatientTaskShell
        mocaVersion="8.3"
        currentStep={2}
        totalSteps={12}
        isEndScreen={false}
        hasEvidence={true}
        saveState={{ status: 'error', message: 'offline save failed' }}
        onNext={onNext}
        onBack={onBack}
      >
        <div>cube task</div>
      </PatientTaskShell>,
    );

    expect(screen.getByText('cube task')).toBeInTheDocument();
    expect(screen.getByTestId('patient-step-indicator')).toHaveTextContent('2/12');
    expect(screen.getByRole('alert')).toHaveTextContent('offline save failed');

    await userEvent.click(screen.getByRole('button', { name: /נסה שוב לשמור/ }));
    expect(onNext).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /חזרה/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```bash
cd client
npm test -- PatientTaskShell.test.tsx
```

Expected: fail because `PatientTaskShell` does not exist.

- [ ] **Step 3: Implement `PatientTaskShell`**

Create `client/src/app/components/patient/PatientTaskShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import type { TaskSaveStatus } from '../../store/AssessmentContext';
import { SaveStateNotice } from '../shared/SaveStateNotice';

interface PatientTaskShellProps {
  children: ReactNode;
  mocaVersion: string;
  currentStep: number;
  totalSteps: number;
  isEndScreen: boolean;
  hasEvidence: boolean;
  saveState?: TaskSaveStatus;
  validationMessage?: string | null;
  onNext: () => void;
  onBack: () => void;
}

export function PatientTaskShell({
  children,
  mocaVersion,
  currentStep,
  totalSteps,
  isEndScreen,
  hasEvidence,
  saveState,
  validationMessage,
  onNext,
  onBack,
}: PatientTaskShellProps) {
  const continueStateId = validationMessage || saveState ? 'continue-state' : undefined;

  return (
    <div dir="rtl" className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-white text-black font-['Heebo',sans-serif]">
      <header className="z-10 border-b border-gray-200 bg-white px-4 py-2.5 sm:px-6 sm:py-3 lg:px-10">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-base font-bold text-white sm:h-10 sm:w-10 sm:text-xl">
              RC
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-base font-bold leading-tight sm:text-lg">Remote Check</div>
              <div className="truncate text-xs text-gray-500 sm:text-sm">הערכה נוירופסיכולוגית</div>
            </div>
          </div>
          <div className="shrink-0 text-center">
            <h1 className="text-base font-bold leading-tight sm:text-xl">MoCA - עברית</h1>
            <div className="text-xs font-medium text-gray-500 sm:text-sm">גרסה {mocaVersion}</div>
          </div>
          <div data-testid="patient-step-indicator" className="shrink-0 text-left font-mono text-base font-extrabold tabular-nums sm:text-lg">
            <div className="inline-flex min-w-14 items-center justify-center rounded-full bg-gray-100 px-3 py-1 text-gray-950 sm:bg-transparent sm:px-0 sm:py-0">
              {isEndScreen ? 'סיום' : `${currentStep}/${totalSteps}`}
            </div>
          </div>
        </div>
      </header>

      <div className="h-1 bg-gray-100 w-full">
        <div className="h-full bg-black transition-all duration-300 ease-out" style={{ width: `${(Math.min(currentStep, totalSteps) / totalSteps) * 100}%` }} />
      </div>

      <main className="mx-auto flex w-full max-w-[1100px] min-w-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6">
        {children}
      </main>

      {!isEndScreen && (
        <footer
          className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.45fr)] items-center gap-3 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.04)] sm:flex sm:flex-wrap sm:justify-between sm:px-6 sm:py-4 lg:px-10 lg:py-5"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <button type="button" onClick={onBack} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 text-base font-semibold text-black transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50 sm:min-h-16 sm:px-8 sm:text-xl">
            <ArrowRight className="w-6 h-6" />
            <span>חזרה</span>
          </button>
          <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-none sm:items-end">
            {validationMessage ? (
              <div id="continue-state" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-extrabold text-amber-900 sm:text-right" role="alert">
                {validationMessage}
              </div>
            ) : (
              <SaveStateNotice id="continue-state" state={saveState} />
            )}
            <button type="button" onClick={onNext} aria-describedby={continueStateId} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-black px-4 text-base font-semibold text-white transition-colors hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50 sm:min-h-16 sm:px-10 sm:text-xl">
              {saveState?.status === 'saving' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>שומר...</span>
                </>
              ) : saveState?.status === 'error' ? (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>נסה שוב לשמור</span>
                </>
              ) : (
                <>
                  <span>{hasEvidence ? 'המשך' : 'דלג והמשך'}</span>
                  <ArrowLeft className="w-6 h-6" />
                </>
              )}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Fix `SaveStateNotice` prop support**

The shell passes `id`. Update `SaveStateNoticeProps`:

```tsx
  id?: string;
```

Pass it to the rendered `div`:

```tsx
id={id}
```

- [ ] **Step 5: Update `AssessmentLayout.tsx` to use shell**

Keep route, state, validation, and navigation logic in `AssessmentLayout.tsx`, but replace the rendered header/main/footer with:

```tsx
return (
  <StimuliManifestProvider>
    <PatientTaskShell
      mocaVersion={mocaVersion}
      currentStep={currentStep}
      totalSteps={patientTaskTotalSteps}
      isEndScreen={isEndScreen}
      hasEvidence={hasEvidence}
      saveState={currentSaveStatus}
      validationMessage={validationMessage}
      onBack={() => navigate(currentStepConfig.prev)}
      onNext={handleNext}
    >
      <StimulusReadinessBanner />
      <Outlet />
    </PatientTaskShell>
  </StimuliManifestProvider>
);
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
cd client
npm test -- SaveStateNotice.test.tsx PatientTaskShell.test.tsx AssessmentLayout.test.tsx
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add client/src/app/components/shared/SaveStateNotice.tsx client/src/app/components/patient/PatientTaskShell.tsx client/src/app/components/patient/PatientTaskShell.test.tsx client/src/app/components/AssessmentLayout.tsx client/src/app/components/__tests__/AssessmentLayout.test.tsx
git commit -m "Extract patient task shell"
```

## Task 4: Improve Drawing Save Recovery Affordance

**Files:**
- Modify: `client/src/app/components/BaseCanvas.tsx`
- Modify: `client/src/app/components/__tests__/BaseCanvas.test.tsx`
- Modify: `client/src/app/components/AssessmentLayout.tsx`

- [ ] **Step 1: Add canvas action visibility test**

Extend `client/src/app/components/__tests__/BaseCanvas.test.tsx` with:

```tsx
it('keeps undo and clear controls available with stable labels after drawing', async () => {
  const onSave = vi.fn();
  render(<BaseCanvas onSave={onSave} />);
  const canvas = screen.getByTestId('drawing-canvas');

  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1, pointerType: 'touch' });
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1, pointerType: 'touch' });
  fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20, pointerId: 1, pointerType: 'touch' });

  expect(screen.getByRole('button', { name: /בטל פעולה/ })).toBeEnabled();
  expect(screen.getByRole('button', { name: /מחיקת ציור/ })).toBeEnabled();
});
```

- [ ] **Step 2: Run focused test**

Run:

```bash
cd client
npm test -- BaseCanvas.test.tsx
```

Expected: pass or fail only on the exact clear label; if it fails, continue with the label change below.

- [ ] **Step 3: Make the clear action label explicit**

In `BaseCanvas.tsx`, change the clear button text from:

```tsx
<span>נקה הכל</span>
```

to:

```tsx
<span>מחיקת ציור</span>
```

Keep the confirmation copy unchanged.

- [ ] **Step 4: Use shell save state for drawing failures**

In `AssessmentLayout.tsx`, keep the existing save-blocking behavior, but make the validation message specific for drawing tasks:

```tsx
const isDrawingTask = currentStepConfig.taskKey === 'trailMaking' || currentStepConfig.taskKey === 'cube' || currentStepConfig.taskKey === 'clock';
```

Inside the `currentSaveStatus?.status === "error"` branch:

```tsx
message: currentSaveStatus.message ?? (isDrawingTask ? 'שמירת הציור נכשלה. בדוק חיבור ונסה שוב לפני המעבר.' : 'שמירת התשובה נכשלה. בדוק חיבור ונסה שוב לפני המעבר.'),
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd client
npm test -- BaseCanvas.test.tsx AssessmentLayout.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/app/components/BaseCanvas.tsx client/src/app/components/__tests__/BaseCanvas.test.tsx client/src/app/components/AssessmentLayout.tsx
git commit -m "Clarify patient drawing recovery"
```

## Task 5: Add Clinician Queue Derivation Helpers

**Files:**
- Create: `client/src/app/components/clinician/clinicianQueue.ts`
- Create: `client/src/app/components/clinician/clinicianQueue.test.ts`
- Modify: `client/src/app/components/ClinicianDashboardList.tsx`

- [ ] **Step 1: Write failing queue helper tests**

Create `client/src/app/components/clinician/clinicianQueue.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveClinicianQueueSummary, deriveClinicianStatus } from './clinicianQueue';

describe('clinicianQueue', () => {
  it('derives review status from awaiting-review session', () => {
    expect(deriveClinicianStatus([
      { status: 'awaiting_review', scoring_reports: { total_provisional: true, needs_review: true, pending_review_count: 2 } },
    ])).toBe('review');
  });

  it('builds queue counts by actionable state', () => {
    const summary = deriveClinicianQueueSummary([
      { status: 'new' },
      { status: 'in_progress' },
      { status: 'review' },
      { status: 'completed' },
    ]);
    expect(summary).toEqual({
      all: 4,
      new: 1,
      in_progress: 1,
      review: 1,
      completed: 1,
    });
  });
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```bash
cd client
npm test -- clinicianQueue.test.ts
```

Expected: fail because `clinicianQueue` does not exist.

- [ ] **Step 3: Implement pure queue helpers**

Create `client/src/app/components/clinician/clinicianQueue.ts`:

```ts
export type ClinicianQueueStatus = 'new' | 'in_progress' | 'review' | 'completed';

export interface ClinicianScoringSummary {
  total_provisional?: boolean | null;
  needs_review?: boolean | null;
  pending_review_count?: number | null;
}

export interface ClinicianSessionSummary {
  status: 'pending' | 'in_progress' | 'completed' | 'awaiting_review';
  scoring_reports?: ClinicianScoringSummary | ClinicianScoringSummary[] | null;
}

export interface ClinicianQueueRow {
  status: ClinicianQueueStatus;
}

function relationArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function reportNeedsReview(report: ClinicianScoringSummary | null | undefined): boolean {
  if (!report) return false;
  return report.total_provisional ?? report.needs_review ?? false;
}

export function deriveClinicianStatus(sessionValue: ClinicianSessionSummary[] | null | undefined): ClinicianQueueStatus {
  const sessions = relationArray(sessionValue);
  if (sessions.length === 0) return 'new';
  if (sessions.some((s) => s.status === 'awaiting_review' || relationArray(s.scoring_reports).some(reportNeedsReview))) return 'review';
  if (sessions.some((s) => s.status === 'in_progress')) return 'in_progress';
  if (sessions.every((s) => s.status === 'completed')) return 'completed';
  return 'new';
}

export function deriveClinicianQueueSummary(rows: ClinicianQueueRow[]) {
  return {
    all: rows.length,
    new: rows.filter((row) => row.status === 'new').length,
    in_progress: rows.filter((row) => row.status === 'in_progress').length,
    review: rows.filter((row) => row.status === 'review').length,
    completed: rows.filter((row) => row.status === 'completed').length,
  };
}
```

- [ ] **Step 4: Use helper in `ClinicianDashboardList.tsx`**

Replace local `deriveStatus` with imported `deriveClinicianStatus`:

```tsx
import { deriveClinicianQueueSummary, deriveClinicianStatus, type ClinicianQueueStatus } from './clinician/clinicianQueue';
```

Update `PatientRow["status"]` to use `ClinicianQueueStatus`.

When mapping rows:

```tsx
status: deriveClinicianStatus(sessions),
```

Use `deriveClinicianQueueSummary(filteredRowsOrRows)` for status counts instead of scattered inline counts.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd client
npm test -- clinicianQueue.test.ts ClinicianDashboardList.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/app/components/clinician/clinicianQueue.ts client/src/app/components/clinician/clinicianQueue.test.ts client/src/app/components/ClinicianDashboardList.tsx
git commit -m "Extract clinician queue state"
```

## Task 6: Add Clinician Work Queue Component

**Files:**
- Create: `client/src/app/components/clinician/ClinicianWorkQueue.tsx`
- Create: `client/src/app/components/clinician/ClinicianWorkQueue.test.tsx`
- Modify: `client/src/app/components/ClinicianDashboardList.tsx`

- [ ] **Step 1: Write failing component test**

Create `client/src/app/components/clinician/ClinicianWorkQueue.test.tsx`:

```tsx
// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClinicianWorkQueue } from './ClinicianWorkQueue';

describe('ClinicianWorkQueue', () => {
  it('shows queue counts and emits selected status', async () => {
    const onChange = vi.fn();
    render(
      <ClinicianWorkQueue
        value="all"
        summary={{ all: 5, new: 1, in_progress: 1, review: 2, completed: 1 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: /ממתינים לסקירה\s+2/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /ממתינים לסקירה\s+2/ }));
    expect(onChange).toHaveBeenCalledWith('review');
  });
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```bash
cd client
npm test -- ClinicianWorkQueue.test.tsx
```

Expected: fail because component does not exist.

- [ ] **Step 3: Implement work queue component**

Create `client/src/app/components/clinician/ClinicianWorkQueue.tsx`:

```tsx
import { clsx } from 'clsx';
import type { ClinicianQueueStatus } from './clinicianQueue';

type QueueValue = 'all' | ClinicianQueueStatus;

interface ClinicianWorkQueueProps {
  value: QueueValue;
  summary: Record<QueueValue, number>;
  onChange: (value: QueueValue) => void;
}

const FILTERS: Array<{ value: QueueValue; label: string }> = [
  { value: 'all', label: 'כל התיקים' },
  { value: 'review', label: 'ממתינים לסקירה' },
  { value: 'in_progress', label: 'בתהליך' },
  { value: 'new', label: 'טרם התחילו' },
  { value: 'completed', label: 'הושלמו' },
];

export function ClinicianWorkQueue({ value, summary, onChange }: ClinicianWorkQueueProps) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-extrabold text-gray-950">תור עבודה</h2>
        <span className="text-xs font-bold text-gray-500">{summary.all} תיקים</span>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="סינון תור עבודה">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onChange(filter.value)}
            className={clsx(
              'inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors',
              value === filter.value
                ? 'border-gray-950 bg-gray-950 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            <span>{filter.label}</span>
            <span className="rounded-full bg-current/10 px-2 py-0.5 tabular-nums">{summary[filter.value]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Use it in dashboard list**

In `ClinicianDashboardList.tsx`, replace the existing status filter button cluster with:

```tsx
<ClinicianWorkQueue
  value={statusFilter}
  summary={deriveClinicianQueueSummary(rows)}
  onChange={setStatusFilter}
/>
```

Keep search and case list behavior unchanged.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd client
npm test -- ClinicianWorkQueue.test.tsx ClinicianDashboardList.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/app/components/clinician/ClinicianWorkQueue.tsx client/src/app/components/clinician/ClinicianWorkQueue.test.tsx client/src/app/components/ClinicianDashboardList.tsx
git commit -m "Add clinician work queue controls"
```

## Task 7: Add Review Workbench Header

**Files:**
- Create: `client/src/app/components/clinician/ReviewWorkbenchHeader.tsx`
- Create: `client/src/app/components/clinician/ReviewWorkbenchHeader.test.tsx`
- Modify: `client/src/app/components/ClinicianDashboardDetail.tsx`

- [ ] **Step 1: Write failing header test**

Create `client/src/app/components/clinician/ReviewWorkbenchHeader.test.tsx`:

```tsx
// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReviewWorkbenchHeader } from './ReviewWorkbenchHeader';

describe('ReviewWorkbenchHeader', () => {
  it('shows provisional state and pending review count', () => {
    render(
      <ReviewWorkbenchHeader
        caseLabel="CASE-1"
        status="awaiting_review"
        pendingReviewCount={3}
        totalScore={24}
        totalProvisional={true}
        canExportPdf={false}
      />,
    );

    expect(screen.getByText('תיק CASE-1')).toBeInTheDocument();
    expect(screen.getByText('3 פריטים ממתינים לסקירה')).toBeInTheDocument();
    expect(screen.getByText('ציון זמני 24/30')).toBeInTheDocument();
    expect(screen.getByText('PDF זמין לאחר סיום סקירה')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```bash
cd client
npm test -- ReviewWorkbenchHeader.test.tsx
```

Expected: fail because component does not exist.

- [ ] **Step 3: Implement header**

Create `client/src/app/components/clinician/ReviewWorkbenchHeader.tsx`:

```tsx
import { ClipboardCheck, FileDown } from 'lucide-react';
import { StatusPill, type StatusPillValue } from '../StatusPill';

interface ReviewWorkbenchHeaderProps {
  caseLabel: string;
  status: StatusPillValue;
  pendingReviewCount: number;
  totalScore: number | null;
  totalProvisional: boolean;
  canExportPdf: boolean;
}

export function ReviewWorkbenchHeader({
  caseLabel,
  status,
  pendingReviewCount,
  totalScore,
  totalProvisional,
  canExportPdf,
}: ReviewWorkbenchHeaderProps) {
  const scoreLabel =
    totalScore == null ? 'ציון עדיין לא זמין' : totalProvisional ? `ציון זמני ${totalScore}/30` : `ציון סופי ${totalScore}/30`;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-gray-950">תיק {caseLabel}</h1>
            <StatusPill status={status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm font-bold text-gray-600">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-amber-900">
              <ClipboardCheck className="h-4 w-4" />
              {pendingReviewCount} פריטים ממתינים לסקירה
            </span>
            <span className="rounded-md bg-gray-100 px-2 py-1">{scoreLabel}</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1">
              <FileDown className="h-4 w-4" />
              {canExportPdf ? 'PDF זמין' : 'PDF זמין לאחר סיום סקירה'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Insert header in detail page**

In `ClinicianDashboardDetail.tsx`, import:

```tsx
import { ReviewWorkbenchHeader } from './clinician/ReviewWorkbenchHeader';
```

Place it near the top of the loaded detail view using existing session/report values:

```tsx
<ReviewWorkbenchHeader
  caseLabel={caseLabel}
  status={session.status as StatusPillValue}
  pendingReviewCount={session.scoring_report?.pending_review_count ?? 0}
  totalScore={session.scoring_report?.total_adjusted ?? session.scoring_report?.total_score ?? null}
  totalProvisional={session.scoring_report?.total_provisional ?? false}
  canExportPdf={session.status === 'completed' && !(session.scoring_report?.total_provisional ?? false)}
/>
```

If `caseLabel` is not already a variable, derive it from the existing patient display helper in the component before render.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd client
npm test -- ReviewWorkbenchHeader.test.tsx ClinicianDashboardDetail.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/app/components/clinician/ReviewWorkbenchHeader.tsx client/src/app/components/clinician/ReviewWorkbenchHeader.test.tsx client/src/app/components/ClinicianDashboardDetail.tsx
git commit -m "Add clinician review workbench header"
```

## Task 8: Add Surface Density Tokens

**Files:**
- Modify: `client/src/styles/index.css`
- Test: client build and lint

- [ ] **Step 1: Add explicit surface density variables**

In `client/src/styles/index.css`, add these variables inside `:root` after `--r-lg`:

```css
  --patient-shell-max-width: 1100px;
  --patient-task-gap: 1rem;
  --patient-action-height: 3rem;
  --clinician-shell-max-width: 1280px;
  --clinician-panel-gap: 0.75rem;
  --clinician-action-height: 2.5rem;
```

Inside `html[data-app-surface="clinician"]`, add:

```css
  --patient-action-height: 2.75rem;
  --clinician-action-height: 2.25rem;
```

- [ ] **Step 2: Use tokens in the patient shell**

In `PatientTaskShell.tsx`, change the main shell width class from:

```tsx
className="mx-auto flex w-full max-w-[1100px] min-w-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6"
```

to:

```tsx
className="mx-auto flex w-full max-w-[var(--patient-shell-max-width)] min-w-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6"
```

- [ ] **Step 3: Run style verification**

Run:

```bash
cd client
npm run lint
npm run build
```

Expected: lint and build pass.

- [ ] **Step 4: Commit**

```bash
git add client/src/styles/index.css client/src/app/components/patient/PatientTaskShell.tsx
git commit -m "Add frontend surface density tokens"
```

## Task 9: Document Frontend Rules And Verification Matrix

**Files:**
- Create: `docs/FRONTEND_READINESS.md`
- Modify: `AGENTS.md`
- Modify: `docs/PATIENT_PWA_ARCHITECTURE.md`
- Modify: `docs/PATIENT_PWA_TRACKER.md`
- Modify: `JOURNEY.md`

- [ ] **Step 1: Create frontend readiness guide**

Create `docs/FRONTEND_READINESS.md`:

```md
# Frontend Readiness

This guide is the implementation-facing frontend quality bar for the patient PWA and clinician operations app.

## Priorities

1. Pilot usability.
2. Reliability and debuggability.
3. Agent-proof structure.

## Patient PWA

- Keep the MoCA task order and backend contracts stable.
- Use a consistent task shell with progress, task title, concise instructions, evidence area, save/retry state, and safe navigation.
- Drawing and audio failures must be visible and recoverable.
- Installed iPad PWA testing is required for pilot readiness.

## Clinician Operations App

- Optimize for desktop/laptop clinical operations.
- Separate actionable work queues from passive history.
- Keep one primary action per screen.
- Make review, finalization, provisional data, and export availability visible.

## Shared Foundation

- Reuse visible states for loading, empty, blocked, saving, saved, retryable error, queued, offline, and completed.
- Keep patient and clinician surface boundaries explicit.
- Extract shared components only when they remove real repeated behavior.

## Verification Matrix

| Change Area | Required Checks |
| --- | --- |
| Patient task shell/save state | `npm test`, `npm run e2e:browser`, iPad installed-PWA manual check |
| Drawing/audio recovery | focused component tests, `npm run e2e:browser`, local rehearsal gate |
| Clinician work queue/detail | focused component tests, clinician desktop walkthrough |
| Surface routing/assets | `npm run build:surfaces`, `npm run verify:surface-builds`, `npm run e2e:patient-pwa` |
```

- [ ] **Step 2: Link docs**

Add `docs/FRONTEND_READINESS.md` to the focused docs table in `AGENTS.md`:

```md
| Frontend readiness, patient/clinician UI rules, verification matrix | [docs/FRONTEND_READINESS.md](docs/FRONTEND_READINESS.md) |
```

Add to `docs/PATIENT_PWA_ARCHITECTURE.md` near verification requirements:

```md
Use `docs/FRONTEND_READINESS.md` for frontend implementation rules, shared state language, and the patient/clinician verification matrix.
```

Add to `docs/PATIENT_PWA_TRACKER.md` under verification policy:

```md
Frontend implementation slices should follow `docs/FRONTEND_READINESS.md` and record skipped device or viewport checks.
```

Add a dated decision to `JOURNEY.md`:

```md
- 2026-05-01: Frontend readiness is tracked separately from backend/local rehearsal. Patient PWA work prioritizes task shell, save/retry clarity, and installed-iPad completion; clinician work moves toward an operations work queue and review workbench.
```

- [ ] **Step 3: Run doc search check**

Run:

```bash
rg -n "FRONTEND_READINESS|Frontend readiness|2026-05-01" docs/PATIENT_PWA_ARCHITECTURE.md docs/PATIENT_PWA_TRACKER.md JOURNEY.md docs/FRONTEND_READINESS.md
```

Expected: links and decision note are present.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs/FRONTEND_READINESS.md docs/PATIENT_PWA_ARCHITECTURE.md docs/PATIENT_PWA_TRACKER.md JOURNEY.md
git commit -m "Document frontend readiness rules"
```

## Task 10: Full Frontend Verification

**Files:**
- No source edits unless verification exposes a bug.

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
cd client
npm test -- SaveStateNotice.test.tsx PatientTaskShell.test.tsx patientTaskFlow.test.ts BaseCanvas.test.tsx ClinicianWorkQueue.test.tsx clinicianQueue.test.ts ReviewWorkbenchHeader.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full frontend baseline**

Run:

```bash
cd client
npm test
npm run lint
npm run build
npm run build:surfaces
npm run verify:surface-builds
```

Expected: all pass.

- [ ] **Step 3: Run browser checks when local Supabase is running**

Run:

```bash
cd client
npm run e2e:browser
```

Expected: local browser E2E passes, with hosted-only tests skipped unless hosted environment variables are set.

- [ ] **Step 4: Run patient PWA preview smoke**

Run a patient preview in one terminal:

```bash
cd client
npm run build:patient:staging
npm run preview:patient:staging -- --host 127.0.0.1 --port 4173 --strictPort
```

Run smoke in another terminal:

```bash
cd client
npm run e2e:patient-pwa
```

Expected: patient PWA smoke passes.

- [ ] **Step 5: Commit verification doc note if needed**

If a check has a repeatable environment caveat, update `docs/FRONTEND_READINESS.md` with the exact caveat and commit:

```bash
git add docs/FRONTEND_READINESS.md
git commit -m "Clarify frontend readiness verification"
```
