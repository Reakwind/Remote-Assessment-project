import { useEffect } from "react";
import type { AppSurface } from "./surface";

export function useDocumentAppSurface(surface: AppSurface) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const previousSurface = root.dataset.appSurface;
    root.dataset.appSurface = surface;

    return () => {
      if (previousSurface) {
        root.dataset.appSurface = previousSurface;
      } else {
        delete root.dataset.appSurface;
      }
    };
  }, [surface]);
}
