import React from 'react';
import { NavLink } from 'react-router-dom';

import "../styles/navbar.css";

const NAV_LINKS = [
  {name: 'home', path: '/'},
  { name: 'analysis', path: '/analysis'},
  {name: 'upload', path: '/upload'},
  {name: 'list', path: '/view'},
  { name: 'search', path: '/search'},
  {name: 'chat', path: '/chat'},
  {name: 'about', path: '/about', isActive: false},
]

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
          { NAV_LINKS.map ((n) => (
            <li>
              <NavLink to={n.path} end className={ navClass }>
                {n.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};