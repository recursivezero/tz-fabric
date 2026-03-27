import { useEffect } from "react";
import ReactGA from "react-ga4";
import { useLocation } from "react-router-dom";

const MEASUREMENT_ID = "G-LSPKHRMZZW";

// Initialize ONCE here, outside the component cycle
ReactGA.initialize(MEASUREMENT_ID);

export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    ReactGA.send({
      hitType: "pageview",
      page: location.pathname + location.search
    });
    console.log("GA4 Tracked:", location.pathname);
  }, [location]);
};
