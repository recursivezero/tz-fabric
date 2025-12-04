import React from 'react';
import { NavLink } from 'react-router-dom';

import "../styles/navbar.css";
import { NAVBAR_MENU } from '../constants';


export const NavBar: React.FC = () => {
  const navClass = ({ isActive }) => (isActive ? "active" : "");
  return (
    <div className="mobile-nav-wrapper">
      <input type="checkbox" id="nav-toggle" className="nav-toggle" />

      <label htmlFor="nav-toggle" className="hamburger">
        <span></span>
        <span></span>
        <span></span>
      </label>

      <nav className="header-nav">
        <ul>
          { NAVBAR_MENU.filter((l) => l.enable !== false).map((n) => (
            <li>
              <NavLink to={ n.path } end className={ navClass }>
                { n.name }
              </NavLink>
            </li>
          )) }
          <li>
            
          </li>
        </ul>
      </nav>
    </div>
  );
};