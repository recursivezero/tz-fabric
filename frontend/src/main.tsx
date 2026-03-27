import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { usePageTracking } from "./hooks/usePageTracking";
import "./index.css";

const rootElement = document.getElementById("root");

// eslint-disable-next-line react-refresh/only-export-components
const TrackingProvider = ({ children }: { children: React.ReactNode }) => {
  usePageTracking(); // This tracks every route change automatically
  return <>{children}</>;
};

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <TrackingProvider>
          <App />
        </TrackingProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
} else {
  console.error("Root element not found");
}
