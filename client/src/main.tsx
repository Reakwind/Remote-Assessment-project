import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { registerPatientServiceWorker } from "./app/patientPwa.ts";
import "./styles/index.css";

registerPatientServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
