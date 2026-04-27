import { useState, useEffect } from 'react';
import { edgeFn, edgeHeaders } from '../lib/supabase';
import { buildDeviceContext } from '../lib/deviceContext';
import type { ScoringContext } from '../types/scoring';

export type SessionStatus =
  | 'loading'
  | 'ready'
  | 'already_used'
  | 'invalid'
  | 'error';

export interface SessionState {
  status: SessionStatus;
  sessionId: string | null;
  linkToken: string | null;
  startToken: string | null;
  scoringContext: ScoringContext | null;
}

interface UseSessionOptions {
  enabled?: boolean;
}

export function useSession(
  tokenOverride?: string,
  options: UseSessionOptions = {},
): SessionState {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    sessionId: null,
    linkToken: null,
    startToken: null,
    scoringContext: null,
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
          }),
        0,
      );
      return;
    }

    fetch(edgeFn('start-session'), {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({ token, deviceContext: buildDeviceContext() }),
    })
      .then(async (res) => {
        if (res.status === 410) {
          setState({
            status: 'already_used',
            sessionId: null,
            linkToken: null,
            startToken: null,
            scoringContext: null,
          });
          return;
        }
        if (!res.ok) {
          setTimeout(
            () =>
              setState({
                status: 'invalid',
                sessionId: null,
                linkToken: null,
                startToken: null,
                scoringContext: null,
              }),
            0,
          );
          return;
        }

        const data = await res.json();
        if (typeof data.educationYears !== 'number' || typeof data.patientAge !== 'number') {
          setState({
            status: 'invalid',
            sessionId: null,
            linkToken: null,
            startToken: null,
            scoringContext: null,
          });
          return;
        }
        setState({
          status: 'ready',
          sessionId: data.sessionId,
          linkToken: data.linkToken ?? token,
          startToken: token,
          scoringContext: {
            sessionId: data.sessionId,
            sessionDate: new Date(data.sessionDate),
            educationYears: data.educationYears,
            patientAge: data.patientAge,
            mocaVersion: data.mocaVersion,
          },
        });
      })
      .catch(() => {
        setState({
          status: 'error',
          sessionId: null,
          linkToken: null,
          startToken: null,
          scoringContext: null,
        });
      });
  }, [tokenOverride, enabled]);

  return state;
}
