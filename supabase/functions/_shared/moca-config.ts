export type MocaVersion = '8.1' | '8.2' | '8.3';

export interface MocaTaskConfig {
  taskId: string;
  max?: number;
}

export interface MocaDomainConfig {
  id: string;
  label: string;
  tasks: MocaTaskConfig[];
}

export interface MocaScoringConfig {
  version: MocaVersion;
  domains: MocaDomainConfig[];
  drawingTasks: string[];
  noScoreTasks: string[];
  targetWords: string[];
  correctAnimalNames: string[];
  fluencyThreshold: number;
  educationCorrectionThreshold: number;
  stimuliPolicy: 'external-licensed-assets';
}

export const SUPPORTED_MOCA_VERSIONS: MocaVersion[] = ['8.1', '8.2', '8.3'];
export const DEFAULT_MOCA_VERSION: MocaVersion = '8.3';

const BASE_DOMAINS: MocaDomainConfig[] = [
  {
    id: 'visuospatial',
    label: 'Visuospatial/Executive',
    tasks: [
      { taskId: 'moca-visuospatial', max: 1 },
      { taskId: 'moca-cube', max: 1 },
      { taskId: 'moca-clock', max: 3 },
    ],
  },
  { id: 'naming', label: 'Naming', tasks: [{ taskId: 'moca-naming', max: 3 }] },
  {
    id: 'attention',
    label: 'Attention',
    tasks: [
      { taskId: 'moca-digit-span', max: 2 },
      { taskId: 'moca-vigilance', max: 1 },
      { taskId: 'moca-serial-7s', max: 3 },
    ],
  },
  { id: 'language', label: 'Language', tasks: [{ taskId: 'moca-language', max: 3 }] },
  { id: 'abstraction', label: 'Abstraction', tasks: [{ taskId: 'moca-abstraction', max: 2 }] },
  { id: 'memory', label: 'Memory', tasks: [{ taskId: 'moca-delayed-recall', max: 5 }] },
  { id: 'orientation', label: 'Orientation', tasks: [{ taskId: 'moca-orientation-task', max: 6 }] },
];

function versionConfig(version: MocaVersion): MocaScoringConfig {
  return {
    version,
    domains: BASE_DOMAINS,
    drawingTasks: ['moca-visuospatial', 'moca-cube', 'moca-clock'],
    noScoreTasks: ['moca-memory-learning'],
    targetWords: ['פנים', 'קטיפה', 'כנסייה', 'חרצית', 'אדום'],
    correctAnimalNames: ['אריה', 'קרנף', 'גמל'],
    fluencyThreshold: 11,
    educationCorrectionThreshold: 12,
    stimuliPolicy: 'external-licensed-assets',
  };
}

export const MOCA_VERSION_CONFIGS: Record<MocaVersion, MocaScoringConfig> = {
  '8.1': versionConfig('8.1'),
  '8.2': versionConfig('8.2'),
  '8.3': versionConfig('8.3'),
};

export function isSupportedMocaVersion(version: unknown): version is MocaVersion {
  return typeof version === 'string' && SUPPORTED_MOCA_VERSIONS.includes(version as MocaVersion);
}

export function getMocaVersionConfig(version: string | null | undefined): MocaScoringConfig {
  const resolvedVersion = version ?? DEFAULT_MOCA_VERSION;
  if (!isSupportedMocaVersion(resolvedVersion)) {
    throw new Error(`Unsupported MoCA version: ${resolvedVersion}`);
  }
  return MOCA_VERSION_CONFIGS[resolvedVersion];
}
