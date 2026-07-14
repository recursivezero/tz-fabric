import { useEffect, useRef, useState } from "react";
import type React from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { NavLinkRenderProps } from "react-router-dom";

import "@/assets/styles/navbar.css";
import { NAVBAR_MENU } from "../constants";

export const NavBar: React.FC = () => {
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

    const firstLink = navRef.current?.querySelector<HTMLAnchorElement>("a");
    firstLink?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      toggleRef.current?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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
          {NAVBAR_MENU.filter((link) => link.enable !== false).map((item) => (
            <li key={item.path}>
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
        </ul>
      </nav>
    </div>
  );
};
