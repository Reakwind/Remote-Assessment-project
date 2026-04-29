// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StimuliManifestProvider,
  StimulusReadinessBanner,
  useStimuliManifest,
} from '../StimuliManifestProvider';

const assessmentMocks = vi.hoisted(() => ({
  useAssessmentStore: vi.fn(),
}));

vi.mock('../../store/AssessmentContext', () => ({
  useAssessmentStore: assessmentMocks.useAssessmentStore,
}));

vi.mock('../../../lib/supabase', () => ({
  edgeFn: (name: string) => `/functions/v1/${name}`,
  edgeHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

const fetchMock = vi.fn();

function ManifestProbe() {
  const { manifest, isLoading, error, getAsset } = useStimuliManifest();
  const cubeAsset = getAsset('cube', 'cube-copy');
  return (
    <div>
      <output data-testid="loading">{String(isLoading)}</output>
      <output data-testid="error">{error ?? ''}</output>
      <output data-testid="version">{manifest?.mocaVersion ?? ''}</output>
      <output data-testid="asset-label">{cubeAsset?.label ?? ''}</output>
    </div>
  );
}

function renderManifest(children = <ManifestProbe />) {
  render(
    <StimuliManifestProvider>
      {children}
    </StimuliManifestProvider>,
  );
}

const manifest = {
  sessionId: 'session-1',
  mocaVersion: '8.3',
  bucket: 'stimuli',
  expiresInSeconds: 300,
  clinicalReady: true,
  missingRequiredCount: 0,
  assets: [
    {
      taskType: 'cube',
      assetId: 'cube-copy',
      label: 'Cube copy',
      kind: 'image',
      contentType: 'image/png',
      required: true,
      storagePath: '8.3/cube.png',
      available: true,
      signedUrl: 'https://storage.test/cube.png',
      missingReason: null,
    },
  ],
};

describe('StimuliManifestProvider', () => {
  beforeEach(() => {
    assessmentMocks.useAssessmentStore.mockReturnValue({
      state: {
        id: 'session-1',
        linkToken: 'link-token',
      },
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('fetches the session manifest and exposes assets by task and asset id', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(manifest), { status: 200 }));

    renderManifest();

    expect(await screen.findByTestId('asset-label')).toHaveTextContent('Cube copy');
    expect(screen.getByTestId('version')).toHaveTextContent('8.3');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      sessionId: 'session-1',
      linkToken: 'link-token',
    });
  });

  it('shows the readiness banner when required visual stimuli are unavailable', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ...manifest,
      clinicalReady: false,
      missingRequiredCount: 1,
      assets: [{
        ...manifest.assets[0],
        available: false,
        signedUrl: null,
        missingReason: 'not_uploaded',
      }],
    }), { status: 200 }));

    renderManifest(<StimulusReadinessBanner />);

    expect(await screen.findByText('גרסת פיתוח: חסרים נכסי מבדק מורשים. מוצגים מצייני מקום לא קליניים.')).toBeInTheDocument();
  });

  it('scopes fetch failures to the active session', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'manifest unavailable' }), { status: 500 }));

    renderManifest();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('error')).toHaveTextContent('manifest unavailable');
    expect(screen.getByTestId('version')).toHaveTextContent('');
  });
});
