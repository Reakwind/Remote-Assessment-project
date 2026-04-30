import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { registerPatientServiceWorker } from "./app/patientPwa.ts";
import { appSurface } from "./app/surface.ts";
import "./styles/index.css";

document.documentElement.dataset.appSurface = appSurface;
registerPatientServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
