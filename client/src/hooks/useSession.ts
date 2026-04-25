import { useState, useEffect } from 'react';
import { edgeAnonHeaders, edgeFn } from '../lib/supabase';
import type { ScoringContext } from '../types/scoring';
import { getResumeStateForToken } from '../app/store/assessmentPersistence';

export type SessionStatus = 'loading' | 'ready' | 'already_used' | 'invalid' | 'error';

export interface SessionState {
  status: SessionStatus;
  sessionId: string | null;
  linkToken: string | null;
  scoringContext: ScoringContext | null;
}

const AGE_BAND_MAP: Record<string, number> = {
  '60-69': 65,
  '70-79': 75,
  '80+': 85,
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
      setState({ status: 'invalid', sessionId: null, linkToken: null, scoringContext: null });
      return;
    }

    const resumeState = getResumeStateForToken(token);
    if (resumeState) {
      setState({
        status: 'ready',
        sessionId: resumeState.id,
        linkToken: token,
        scoringContext: resumeState.scoringContext,
      });
      return;
    }

    fetch(edgeFn('start-session'), {
      method: 'POST',
      headers: edgeAnonHeaders,
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.status === 410) {
          setState({ status: 'already_used', sessionId: null, linkToken: null, scoringContext: null });
          return;
        }
        if (!res.ok) {
          setState({ status: 'invalid', sessionId: null, linkToken: null, scoringContext: null });
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
            mocaVersion:     data.mocaVersion,
            educationYears:  data.educationYears || 12,
            patientAge:      AGE_BAND_MAP[data.ageBand] ?? 70,
            sessionLocation: { place: data.locationPlace ?? '', city: data.locationCity ?? '' },
          },
        });
      })
      .catch(() => {
        setState({ status: 'error', sessionId: null, linkToken: null, scoringContext: null });
      });
  }, [tokenOverride]);

  return state;
}
