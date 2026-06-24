import type React from "react";
import { useEffect, useState } from "react";
import { FaRegMoon, FaRegSun } from "react-icons/fa";
import { useLocation } from "react-router-dom";

import "./App.css";
import { Routing } from "./Routing";
import Footer from "./components/Footer";
import { NavBar } from "./components/NavBar";

type ThemeMode = "light" | "dark";

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
      themeColor.content = theme === "dark" ? "#111111" : "#f7f2e8";
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
            {theme === "dark" ? <FaRegSun /> : <FaRegMoon />}
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
