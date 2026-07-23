import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";
import "@/assets/styles/_makeover.css";
import "@/assets/styles/SeniorUiFixes.css";
import "@/assets/styles/ReaderAnalysisContrastFixes.css";
import "@/assets/styles/AnalysisUploadButtonParity.css";
import "@/assets/styles/AnalysisHeaderVisibilityParity.css";
import "@/assets/styles/HomeViewportNavigationFix.css";
import "@/assets/styles/CrossRouteLayoutCompletion.css";
import "@/assets/styles/MobileViewportStability.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  document.documentElement.dataset.appBooted = "true";
  document.getElementById("app-boot-fallback")?.setAttribute("hidden", "");

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
} else {
  console.error("Root element not found");
}
