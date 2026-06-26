import type React from 'react';
import { NavLink } from 'react-router-dom';

import "@/assets/styles/navbar.css";
import { NAVBAR_MENU } from '../constants';

export const NavBar: React.FC = () => {
  const navClass = ({ isActive }) => (isActive ? "active" : "");
  return (
    <div className="mobile-nav-wrapper">
      <input
        type="checkbox"
        id="nav-toggle"
        className="nav-toggle"
        aria-label="Open navigation menu"
      />

      <label htmlFor="nav-toggle" className="hamburger" aria-label="Toggle navigation menu">
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </label>

      <nav className="header-nav" aria-label="Primary navigation">
        <ul>
          {NAVBAR_MENU.filter((l) => l.enable !== false).map((n) => (
            <li key={n.path}>
              <NavLink to={n.path} end className={navClass}>
                {n.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};
