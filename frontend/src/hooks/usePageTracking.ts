import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const MEASUREMENT_ID = String(
  import.meta.env.VITE_GA_MEASUREMENT_ID ?? "",
).trim();
const ANALYTICS_ENABLED =
  import.meta.env.VITE_ANALYTICS_ENABLED === "true" && !!MEASUREMENT_ID;

let analyticsModulePromise: Promise<typeof import("react-ga4")> | null = null;
let analyticsInitialized = false;

function privacySignalEnabled(): boolean {
  if (typeof navigator === "undefined") return false;

  const browser = navigator as Navigator & { globalPrivacyControl?: boolean };
  const browserWindow = window as Window & { doNotTrack?: string };
  return (
    browser.globalPrivacyControl === true ||
    navigator.doNotTrack === "1" ||
    browserWindow.doNotTrack === "1"
  );
}

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
    if (import.meta.env.DEV || !ANALYTICS_ENABLED || privacySignalEnabled()) {
      return;
    }

    let cancelled = false;
    const page = `${location.pathname}${location.search}`;

    void loadAnalytics()
      .then((ReactGA) => {
        if (!cancelled) ReactGA.send({ hitType: "pageview", page });
      })
      .catch(() => {
        // Analytics is optional and must never interrupt the product flow.
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);
};
