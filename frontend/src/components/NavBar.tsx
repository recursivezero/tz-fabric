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

  useEffect(() => {
    if (!location.pathname.startsWith("/analysis")) return;

    const copiedProperties = [
      "background",
      "border-color",
      "color",
      "box-shadow",
      "text-shadow",
      "-webkit-text-fill-color",
    ] as const;
    const resetProperties = [
      ...copiedProperties,
      "opacity",
      "filter",
      "mix-blend-mode",
    ] as const;

    let activeAnalysisLink: HTMLAnchorElement | null = null;
    let styledAncestors: HTMLElement[] = [];
    let animationFrameId: number | null = null;

    const clearInlineParityStyles = () => {
      if (activeAnalysisLink) {
        for (const property of resetProperties) {
          activeAnalysisLink.style.removeProperty(property);
        }
      }

      for (const ancestor of styledAncestors) {
        ancestor.style.removeProperty("opacity");
        ancestor.style.removeProperty("filter");
        ancestor.style.removeProperty("mix-blend-mode");
      }
      styledAncestors = [];
    };

    const applyParityStyles = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        const activeLink =
          navRef.current?.querySelector<HTMLAnchorElement>(
            'a.active[aria-current="page"]',
          ) ?? null;
        const sourceButton = document.querySelector<HTMLElement>(
          ".analysis-page .preview-buttons-container .analysis-btn",
        );

        // The Analysis route is lazy-loaded. Do not give up when its button is
        // not present during the navbar's first effect; the DOM observer below
        // calls this again as soon as the route content mounts.
        if (!activeLink || !sourceButton) return;

        clearInlineParityStyles();
        activeAnalysisLink = activeLink;
        const sourceStyles = window.getComputedStyle(sourceButton);

        for (const property of copiedProperties) {
          const value = sourceStyles.getPropertyValue(property);
          if (value) activeLink.style.setProperty(property, value, "important");
        }

        activeLink.style.setProperty("opacity", "1", "important");
        activeLink.style.setProperty("filter", "none", "important");
        activeLink.style.setProperty("mix-blend-mode", "normal", "important");

        let ancestor: HTMLElement | null = activeLink.parentElement;
        const header = activeLink.closest<HTMLElement>(".site-header");
        while (ancestor) {
          ancestor.style.setProperty("opacity", "1", "important");
          ancestor.style.setProperty("filter", "none", "important");
          ancestor.style.setProperty("mix-blend-mode", "normal", "important");
          styledAncestors.push(ancestor);
          if (ancestor === header) break;
          ancestor = ancestor.parentElement;
        }
      });
    };

    applyParityStyles();

    const routeContentObserver = new MutationObserver(applyParityStyles);
    routeContentObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const themeObserver = new MutationObserver(applyParityStyles);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      routeContentObserver.disconnect();
      themeObserver.disconnect();
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      clearInlineParityStyles();
    };
  }, [location.pathname]);

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
