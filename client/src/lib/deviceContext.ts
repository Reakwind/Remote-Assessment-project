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
  formFactor?: "phone" | "tablet" | "desktop";
  orientation?: "portrait" | "landscape";
}

export function buildDeviceContext(): PatientDeviceContext {
  const nav = window.navigator;
  const screenInfo = window.screen;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const touchPoints = nav.maxTouchPoints;
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    languages: Array.from(nav.languages ?? []),
    screenWidth: screenInfo?.width,
    screenHeight: screenInfo?.height,
    viewportWidth,
    viewportHeight,
    devicePixelRatio: window.devicePixelRatio,
    touchPoints,
    standalone: isStandaloneDisplay(),
    pointer: matchMediaValue("(pointer: coarse)", "coarse", "fine"),
    hover: matchMediaValue("(hover: hover)", "hover", "none"),
    formFactor: classifyFormFactor(viewportWidth, viewportHeight, touchPoints),
    orientation: classifyOrientation(viewportWidth, viewportHeight),
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

function classifyFormFactor(
  viewportWidth: number,
  viewportHeight: number,
  touchPoints: number,
): PatientDeviceContext["formFactor"] {
  const shortSide = Math.min(viewportWidth, viewportHeight);
  const longSide = Math.max(viewportWidth, viewportHeight);
  if (shortSide < 600) return "phone";
  if (touchPoints > 0 && longSide <= 1400) return "tablet";
  return "desktop";
}

function classifyOrientation(
  viewportWidth: number,
  viewportHeight: number,
): PatientDeviceContext["orientation"] {
  return viewportHeight >= viewportWidth ? "portrait" : "landscape";
}
