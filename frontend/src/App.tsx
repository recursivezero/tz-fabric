import type React from "react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import "./App.css";
import { Routing } from "./Routing";
import Footer from "./components/Footer";
import { NavBar } from "./components/NavBar";

type ThemeMode = "light" | "dark";

const SunIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M12 2.75v2.1M12 19.15v2.1M4.85 4.85l1.5 1.5M17.65 17.65l1.5 1.5M2.75 12h2.1M19.15 12h2.1M4.85 19.15l1.5-1.5M17.65 6.35l1.5-1.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const MoonIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none">
    <path
      d="M20.2 14.15A7.55 7.55 0 0 1 9.85 3.8 8.7 8.7 0 1 0 20.2 14.15Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const getInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const savedTheme = window.localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

const App: React.FC = () => {
  const location = useLocation();
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const isChatRoute = location.pathname.startsWith("/chat");
  const isAnalysisRoute = location.pathname.startsWith("/analysis");
  const isWorkspaceRoute = isChatRoute || isAnalysisRoute;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("theme", theme);

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.content = theme === "dark" ? "#0e1322" : "#f8fafc";
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  return (
    <div
      className={`app-wrapper ${isChatRoute ? "app-wrapper--chat" : ""} ${
        isAnalysisRoute ? "app-wrapper--analysis" : ""
      }`}
    >
      <header className="site-header">
        <div className="header-left">
          <div className="logo-mark" aria-hidden>
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="FabricAI logo"
            >
              <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#2F6BFF" />
              <path
                d="M7 12c2 2 6 2 8 0"
                stroke="white"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="10" r="0.9" fill="white" />
              <circle cx="12" cy="9" r="0.9" fill="white" />
              <circle cx="16" cy="10" r="0.9" fill="white" />
            </svg>
          </div>

          <div className="brand">
            <div className="brand-name">FabricAI</div>
          </div>
        </div>
        <div className="header-center">
          <NavBar />
        </div>
        <div className="header-right action">
          <button
            id="theme"
            type="button"
            className="theme-toggle"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            aria-pressed={theme === "dark"}
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <span className="theme-toggle__track" aria-hidden="true">
              <span className="theme-toggle__icon theme-toggle__icon--sun">
                <SunIcon />
              </span>
              <span className="theme-toggle__icon theme-toggle__icon--moon">
                <MoonIcon />
              </span>
              <span className="theme-toggle__thumb">
                {theme === "dark" ? <MoonIcon /> : <SunIcon />}
              </span>
            </span>
          </button>
        </div>
      </header>

      <main className="main-content">
        <Routing />
      </main>

      {!isWorkspaceRoute && <Footer />}
    </div>
  );
};

export default App;
