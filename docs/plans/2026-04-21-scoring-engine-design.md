# Scoring Engine Design — Hebrew MoCA Remote Assessment

**Date:** 2026-04-21  
**Status:** Approved — ready for implementation

---

## Core Principles

Standardization, scoring accuracy, and data privacy always outweigh automation.  
No patient data (drawings, responses, metadata) is ever sent to external AI models.

---

## Output: ScoringReport

```typescript
interface ItemScore {
  taskId: string;
  score: number;
  max: number;
  needsReview: boolean;     // true = pending clinician manual score
  reviewReason?: string;    // 'drawing' | 'rule_score_unavailable'
  rawData?: any;            // preserved when needsReview=true
}

interface DomainScore {
  domain: string;
  raw: number;
  max: number;
  items: ItemScore[];
}

interface ScoringReport {
  sessionId: string;
  totalRaw: number;           // sum of scored items only
  totalAdjusted: number;      // equals totalRaw; education is used for norm lookup only
  totalProvisional: boolean;  // true if any needsReview items pending
  educationYears: number;
  normPercentile: number;     // from Lifshitz norms, null if provisional
  normSd: number;             // z-score from norm mean
  domains: DomainScore[];
  pendingReviewCount: number;
  completedAt: string;
}
```

Total is **provisional** until all `needsReview` items are manually scored by clinician.  
Norm percentile only computed when total is final (no pending items).

---

## Auto-Scoring Rules

Scoring entry point: `scoreSession(results, ctx)` — pure function, no side effects.

| Task | Payload | Rule | Max |
|------|---------|------|-----|
| `moca-orientation-task` | `{date,month,year,day,place,city}` | Compare vs sessionDate + session location. Fuzzy normalize (strip whitespace, canonical Hebrew month names). 1pt each. | 6 |
| `moca-digit-span` | `{forward:{isCorrect}, backward:{isCorrect}}` | 1pt each | 2 |
| `moca-vigilance` | `{score}` | Pass-through (already computed in component) | 1 |
| `moca-serial-7s` | `[{isCorrect}]` × 5 | 4–5 correct→3pt, 2–3→2pt, 1→1pt, 0→0 | 3 |
| `moca-language` | `{rep1:bool, rep2:bool, fluencyCount:number}` | rep1+rep2 (1pt each) + fluency≥11 words (1pt) | 3 |
| `moca-abstraction` | `{pair1:bool, pair2:bool}` | 1pt each | 2 |
| `moca-delayed-recall` | `{recalled:string[]}` | Match vs 5 target words from i18n. 1pt each. | 5 |
| `moca-naming` | `(string\|null)[]` | Compare vs `['אריה','קרנף','גמל']`. 1pt each. | 3 |
| `moca-memory-learning` | registration only | No points in MoCA | 0 |
| `moca-cube` | canvas imageData | Manual clinician rubric. `needsReview: true, reviewReason: 'drawing'` | 1 |
| `moca-clock` | canvas imageData | Manual clinician rubric (3 criteria). `needsReview: true, reviewReason: 'drawing'` | 3 |
| `moca-visuospatial` | canvas imageData | Manual clinician rubric. `needsReview: true, reviewReason: 'drawing'` | 1 |

**Rule-scoring fallback:** unsupported or malformed payloads create `needsReview: true, reviewReason: 'rule_score_unavailable', rawData: preserved`. Never silently zero.

---

## Domain Map

| Domain | Tasks | Max |
|--------|-------|-----|
| Visuospatial/Executive | moca-visuospatial, moca-cube, moca-clock | 5 |
| Naming | moca-naming | 3 |
| Attention | moca-digit-span, moca-vigilance, moca-serial-7s | 6 |
| Language | moca-language | 3 |
| Abstraction | moca-abstraction | 2 |
| Memory | moca-delayed-recall | 5 |
| Orientation | moca-orientation-task | 6 |
| **Total** | | **30** |

---

## Norm Lookup (Lifshitz et al., 2012)

Stored in `client/src/data/lifshitz-norms.json`:
- Keyed by age band × education band (`≤12yrs` / `>12yrs`)
- Each entry: `{ mean: number, sd: number }`
- z-score = `(totalAdjusted - mean) / sd`
- Percentile from standard normal CDF (local approximation, no external lib)
- Education is used for norm lookup only; no bonus point is added to the MoCA total.
- Clinician supplies `educationYears` at session creation — never asked of patient

---

## Drawing Storage

Supabase Edge Function `save-drawing`:
- Receives base64 PNG from client after task complete
- Stores to Supabase Storage (Israeli region)
- Returns storage URL saved to session record
- No external model calls — ever

---

## File Structure

```
client/src/
├── types/scoring.ts
├── data/
│   └── lifshitz-norms.json
├── lib/scoring/
│   ├── index.ts        — scoreSession() orchestrator
│   ├── moca-config.ts  — supported MoCA versions and rule config
│   ├── scorers.ts      — per-task pure functions
│   ├── norms.ts        — norm lookup + percentile
│   └── utils.ts        — Hebrew normalizer + safe wrapper
└── hooks/useScoring.ts

supabase/functions/save-drawing/
└── index.ts
```

---

## Implementation Order

1. `types/scoring.ts`
2. `lib/scoring/moca-config.ts`
3. `data/lifshitz-norms.json`
4. `lib/scoring/utils.ts`
5. `lib/scoring/scorers.ts` (TDD)
6. `lib/scoring/norms.ts`
7. `lib/scoring/index.ts`
8. `hooks/useScoring.ts`
9. `supabase/functions/save-drawing/index.ts`
