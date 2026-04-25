import { useState, useEffect } from 'react';
import { edgeFn, edgeHeaders } from '../lib/supabase';
import type { ScoringContext } from '../types/scoring';

export type SessionStatus =
  | 'loading'
  | 'ready'
  | 'code_required'
  | 'invalid_code'
  | 'already_used'
  | 'invalid'
  | 'error';

export interface SessionState {
  status: SessionStatus;
  sessionId: string | null;
  linkToken: string | null;
  startToken: string | null;
  scoringContext: ScoringContext | null;
  requiresAccessCode: boolean;
}

interface UseSessionOptions {
  enabled?: boolean;
}

const AGE_BAND_MAP: Record<string, number> = {
  '60-64': 62,
  '65-69': 67,
  '70-74': 72,
  '75-79': 77,
  '80+':   85,
};

export function useSession(
  tokenOverride?: string,
  accessCodeOverride?: string,
  options: UseSessionOptions = {},
): SessionState {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    sessionId: null,
    linkToken: null,
    startToken: null,
    scoringContext: null,
    requiresAccessCode: false,
  });

  useEffect(() => {
    if (!enabled) return;

    // The app uses a hash router; a ?t= query param would be parsed by the
    // hash segment, not window.location.search. Accept token strictly via
    // the route param passed in as tokenOverride.
    const token = tokenOverride;

    if (!token) {
      setTimeout(
        () =>
          setState({
            status: 'invalid',
            sessionId: null,
            linkToken: null,
            startToken: null,
            scoringContext: null,
            requiresAccessCode: false,
          }),
        0,
      );
      return;
    }

    fetch(edgeFn('start-session'), {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({ token, accessCode: accessCodeOverride }),
    })
      .then(async (res) => {
        if (res.status === 410) {
          setState({
            status: 'already_used',
            sessionId: null,
            linkToken: null,
            startToken: null,
            scoringContext: null,
            requiresAccessCode: false,
          });
          return;
        }
        if (!res.ok) {
          if (res.status === 401) {
            setState({
              status: 'invalid_code',
              sessionId: null,
              linkToken: null,
              startToken: null,
              scoringContext: null,
              requiresAccessCode: true,
            });
            return;
          }
          setTimeout(
            () =>
              setState({
                status: 'invalid',
                sessionId: null,
                linkToken: null,
                startToken: null,
                scoringContext: null,
                requiresAccessCode: false,
              }),
            0,
          );
          return;
        }

        const data = await res.json();
        if (data.status === 'code_required') {
          setState({
            status: 'code_required',
            sessionId: data.sessionId,
            linkToken: data.linkToken ?? token,
            startToken: token,
            scoringContext: null,
            requiresAccessCode: true,
          });
          return;
        }

        setState({
          status: 'ready',
          sessionId: data.sessionId,
          linkToken: data.linkToken ?? token,
          startToken: token,
          scoringContext: {
            sessionId:       data.sessionId,
            sessionDate:     new Date(data.sessionDate),
            educationYears:  data.educationYears || 12,
            patientAge:      AGE_BAND_MAP[data.ageBand] ?? 70,
            mocaVersion:     data.mocaVersion,
          },
          requiresAccessCode: false,
        });
      })
      .catch(() => {
        setState({
          status: 'error',
          sessionId: null,
          linkToken: null,
          startToken: null,
          scoringContext: null,
          requiresAccessCode: false,
        });
      });
  }, [tokenOverride, accessCodeOverride, enabled]);

  return state;
}
