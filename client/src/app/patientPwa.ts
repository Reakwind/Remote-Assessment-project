import { shouldRegisterPatientServiceWorker } from "./surface";

export function registerPatientServiceWorker(): void {
  if (!shouldRegisterPatientServiceWorker()) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/patient-sw.js").catch((error) => {
      console.error("Failed to register patient service worker", error);
    });
  });
}
