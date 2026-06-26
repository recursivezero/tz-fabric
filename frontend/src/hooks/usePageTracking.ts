import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "G-LSPKHRMZZW";
const TRACKING_DELAY_MS = 1600;

let analyticsModulePromise: Promise<typeof import("react-ga4")> | null = null;
let analyticsInitialized = false;

const loadAnalytics = async () => {
  analyticsModulePromise ??= import("react-ga4");
  const { default: ReactGA } = await analyticsModulePromise;

  if (!analyticsInitialized) {
    ReactGA.initialize(MEASUREMENT_ID);
    analyticsInitialized = true;
  }

  return ReactGA;
};

export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV || !MEASUREMENT_ID) {
      return;
    }

    const page = `${location.pathname}${location.search}`;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      if (cancelled) return;

      try {
        const ReactGA = await loadAnalytics();
        if (!cancelled) {
          ReactGA.send({ hitType: "pageview", page });
        }
      } catch {
        // Analytics should never block or fail the UI.
      }
    }, TRACKING_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [location.pathname, location.search]);
};
