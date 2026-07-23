import { useEffect, useRef, useState } from "react";
import type React from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { NavLinkRenderProps } from "react-router-dom";

import "@/assets/styles/navbar.css";
import { NAVBAR_MENU } from "../constants";

type ThemeMode = "light" | "dark";

type NavBarProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

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

export const NavBar: React.FC<NavBarProps> = ({ theme, onToggleTheme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const navClass = ({ isActive }: NavLinkRenderProps) =>
    isActive ? "active" : "";

  useEffect(() => {
    if (location.pathname) setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const firstLink = navRef.current?.querySelector<HTMLAnchorElement>(
      'a[href]:not([aria-hidden="true"])',
    );
    firstLink?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      toggleRef.current?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="mobile-nav-wrapper">
      <button
        ref={toggleRef}
        type="button"
        className="hamburger"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-controls="primary-navigation"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <nav
        ref={navRef}
        id="primary-navigation"
        className="header-nav"
        data-open={isOpen}
        aria-label="Primary navigation"
      >
        <ul>
          <li className="mobile-menu__brand" aria-hidden="true">
            <span className="mobile-menu__brand-mark">FI</span>
            <span className="mobile-menu__brand-name">FabricAI</span>
          </li>

          {NAVBAR_MENU.filter((link) => link.enable !== false).map((item) => (
            <li className="mobile-menu__route" key={item.path}>
              <NavLink
                to={item.path}
                end
                className={navClass}
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </NavLink>
            </li>
          ))}

          <li className="mobile-menu__theme">
            <span className="mobile-menu__theme-label">Appearance</span>
            <button
              type="button"
              className="mobile-menu__theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onToggleTheme}
            >
              <span className="mobile-menu__theme-icon" aria-hidden="true">
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </span>
              <span>Switch to {theme === "dark" ? "light" : "dark"} mode</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};
