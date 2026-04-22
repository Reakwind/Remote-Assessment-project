import { useState, useEffect } from 'react';
import { edgeFn } from '../lib/supabase';
import type { ScoringContext } from '../types/scoring';

export type SessionStatus = 'loading' | 'ready' | 'already_used' | 'invalid' | 'error';

export interface SessionState {
  status: SessionStatus;
  sessionId: string | null;
  linkToken: string | null;
  scoringContext: ScoringContext | null;
}

const AGE_BAND_MAP: Record<string, number> = {
  '60-64': 62,
  '65-69': 67,
  '70-74': 72,
  '75-79': 77,
  '80+':   85,
};

export function useSession(tokenOverride?: string): SessionState {
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    sessionId: null,
    linkToken: null,
    scoringContext: null,
  });

  useEffect(() => {
    const token = tokenOverride || new URLSearchParams(window.location.search).get('t');

    if (!token) {
      setTimeout(() => setState({ status: 'invalid', sessionId: null, linkToken: null, scoringContext: null }), 0);
      return;
    }

    fetch(edgeFn('start-session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.status === 410) {
          setState({ status: 'already_used', sessionId: null, linkToken: null, scoringContext: null });
          return;
        }
        if (!res.ok) {
          setTimeout(() => setState({ status: 'invalid', sessionId: null, linkToken: null, scoringContext: null }), 0);
          return;
        }

        const data = await res.json();
        setState({
          status: 'ready',
          sessionId: data.sessionId,
          linkToken: token,
          scoringContext: {
            sessionId:       data.sessionId,
            sessionDate:     new Date(data.sessionDate),
            educationYears:  data.educationYears || 12,
            patientAge:      AGE_BAND_MAP[data.ageBand] ?? 70,
            sessionLocation: { place: 'Home', city: 'Israel' },
          },
        });
      })
      .catch(() => {
        setState({ status: 'error', sessionId: null, linkToken: null, scoringContext: null });
      });
  }, [tokenOverride]);

  return state;
}
