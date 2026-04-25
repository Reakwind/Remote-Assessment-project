import manifestConfig from './stimulus-manifest-data.json' with { type: 'json' };

export type StimulusAssetKind = 'image' | 'audio' | 'pdf';

export interface StimulusManifestEntry {
  taskType: string;
  assetId: string;
  label: string;
  kind: StimulusAssetKind;
  contentType: string;
  required: boolean;
  storagePath: string;
}

interface StimulusManifestConfig {
  versions: string[];
  assets: Array<Omit<StimulusManifestEntry, 'storagePath'>>;
}

const CONFIG = manifestConfig as StimulusManifestConfig;
const SUPPORTED_MOCA_VERSIONS = CONFIG.versions;

const TASK_ASSETS = CONFIG.assets;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/png': 'png',
  'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
};

export function supportedMocaVersions(): string[] {
  return [...SUPPORTED_MOCA_VERSIONS];
}

export function isSupportedMocaVersion(version: string): boolean {
  return SUPPORTED_MOCA_VERSIONS.includes(version);
}

export function buildStimulusManifest(mocaVersion: string): StimulusManifestEntry[] {
  if (!isSupportedMocaVersion(mocaVersion)) {
    throw new Error(`Unsupported MoCA version: ${mocaVersion}`);
  }

  return TASK_ASSETS.map((asset) => ({
    ...asset,
    storagePath: `${mocaVersion}/${asset.taskType}/${asset.assetId}.${extensionFor(asset.contentType)}`,
  }));
}

function extensionFor(contentType: string): string {
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType];
  if (!extension) throw new Error(`Unsupported stimulus content type: ${contentType}`);
  return extension;
}
