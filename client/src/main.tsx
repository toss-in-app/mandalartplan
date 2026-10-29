import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import config from "../apps-in-toss.config.ts";
import App from "./App.tsx";
import "./index.css";
import { startClarity } from "./lib/clarity.ts";

startClarity({ mode: import.meta.env.MODE, projectId: import.meta.env.VITE_CLARITY_PROJECT_ID, version: __APP_VERSION__ });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TDSMobileAITProvider brandPrimaryColor={config.brand.primaryColor}>
      <App />
    </TDSMobileAITProvider>
  </StrictMode>,
);
