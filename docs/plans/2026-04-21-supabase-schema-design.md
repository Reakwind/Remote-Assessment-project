# Supabase Schema & Backend Design

**Date:** 2026-04-21  
**Status:** Approved — ready for implementation

---

## Privacy & Legal Constraints

- Platform = data processor under Israeli Protection of Privacy Law 5741-1981
- Zero PII stored — case IDs only, PII stays in clinic's own records
- Age band stored (not exact age) — sufficient for Lifshitz norms
- Data region: AWS `il-central-1` (Tel Aviv)
- No E2EE — pseudonymization + RLS + no PII + DPA satisfies Israeli law
- Patient retention: clinics keep records 7 years (their obligation, not platform's)

---

## Tables

```sql
create table clinicians (
  id          uuid primary key references auth.users(id),
  clinic_name text not null,
  created_at  timestamptz default now()
);

create table sessions (
  id               uuid primary key default gen_random_uuid(),
  clinician_id     uuid not null references clinicians(id),
  case_id          text not null,
  age_band         text not null check (age_band in ('60-69','70-79','80+')),
  education_years  int  not null check (education_years >= 0),
  location_place   text, -- legacy optional field, not part of MVP session creation
  location_city    text, -- legacy optional field, not part of MVP session creation
  link_token       uuid unique not null default gen_random_uuid(),
  link_used_at     timestamptz,
  status           text not null default 'pending'
                     check (status in ('pending','in_progress','completed','awaiting_review')),
  created_at       timestamptz default now(),
  completed_at     timestamptz
);

create table task_results (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  task_type   text not null,
  raw_data    jsonb not null,
  created_at  timestamptz default now()
);

create table scoring_reports (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid unique not null references sessions(id) on delete cascade,
  total_raw            int not null,
  total_adjusted       int not null,
  total_provisional    boolean not null default true,
  norm_percentile      float,
  norm_sd              float,
  pending_review_count int not null,
  domains              jsonb not null,
  completed_at         timestamptz default now()
);

create table drawing_reviews (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references sessions(id) on delete cascade,
  task_id         text not null check (task_id in ('moca-cube','moca-clock','moca-visuospatial')),
  drawing_url     text not null,
  clinician_score int,
  clinician_notes text,
  reviewed_at     timestamptz,
  unique(session_id, task_id)
);
```

---

## Row Level Security

All tables: RLS enabled. Clinicians see only their own sessions and related data.
Patient writes go exclusively through Edge Functions using `service_role` key — patient has zero direct DB access.

```sql
alter table sessions        enable row level security;
alter table task_results    enable row level security;
alter table scoring_reports enable row level security;
alter table drawing_reviews enable row level security;

create policy "clinician_own_sessions"
  on sessions for all using (clinician_id = auth.uid());

create policy "clinician_own_task_results"
  on task_results for all using (
    session_id in (select id from sessions where clinician_id = auth.uid())
  );

create policy "clinician_own_scoring_reports"
  on scoring_reports for all using (
    session_id in (select id from sessions where clinician_id = auth.uid())
  );

create policy "clinician_own_drawing_reviews"
  on drawing_reviews for all using (
    session_id in (select id from sessions where clinician_id = auth.uid())
  );
```

---

## Storage

Bucket: `assessment-drawings` — private, no public access.
Path pattern: `{session_id}/{task_id}.png`
Access: signed URLs generated server-side only, never exposed directly.

---

## Edge Functions

| Function | Caller | Purpose |
|----------|--------|---------|
| `start-session` | Patient browser | Validate token, mark in_progress, return scoring context |
| `submit-results` | Patient browser | Upsert task result (idempotent, connection-loss safe) |
| `complete-session` | Patient browser | Save scoring report, create drawing_reviews, email clinician |
| `save-drawing` | Patient browser | Canvas PNG → Storage (already built) |

### start-session
- `POST { token }`
- Rejects if `link_used_at` not null (single-use enforcement)
- Sets `link_used_at = now()`, `status = 'in_progress'`
- Returns `{ sessionId, ageBand, educationYears, sessionDate }`

### submit-results
- `POST { sessionId, taskType, rawData }`
- Validates session is `in_progress`
- Upserts `task_results` — idempotent on (sessionId, taskType)

### complete-session
- `POST { sessionId, scoringReport, drawingUrls }`
- Inserts `scoring_report`
- Inserts `drawing_reviews` rows (score=null)
- Sets status: `awaiting_review` if drawings pending, else `completed`
- Emails clinician via Resend (badge + link to dashboard)

---

## Session Link Flow

```
Clinician creates session → DB row inserted → test number generated
Clinician copies test number and sends it to patient outside the app
Patient enters test number → start-session validates it → single-use flag set
Patient completes battery → submit-results called per task
Patient finishes → complete-session → clinician notified
Clinician logs in → reviews drawings → scoring_report finalized
```
