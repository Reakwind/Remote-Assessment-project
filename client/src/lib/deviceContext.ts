export interface PatientDeviceContext {
  userAgent?: string;
  platform?: string;
  language?: string;
  languages?: string[];
  screenWidth?: number;
  screenHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  touchPoints?: number;
  standalone?: boolean;
  pointer?: string;
  hover?: string;
}

export function buildDeviceContext(): PatientDeviceContext {
  const nav = window.navigator;
  const screenInfo = window.screen;
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    languages: Array.from(nav.languages ?? []),
    screenWidth: screenInfo?.width,
    screenHeight: screenInfo?.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    touchPoints: nav.maxTouchPoints,
    standalone: isStandaloneDisplay(),
    pointer: matchMediaValue("(pointer: coarse)", "coarse", "fine"),
    hover: matchMediaValue("(hover: hover)", "hover", "none"),
  };
}

function isStandaloneDisplay(): boolean {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone,
  );
}

function matchMediaValue(query: string, matching: string, fallback: string): string {
  return window.matchMedia?.(query).matches ? matching : fallback;
}
