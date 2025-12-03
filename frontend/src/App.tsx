import React from "react";
import { NavLink } from "react-router-dom";
import "./App.css";
import "./styles/navbar.css";
import { Routing } from "./Routing";
import Footer from "./components/Footer";

const App: React.FC = () => {
  return (
    <div className="app-wrapper">
      <header className="site-header">
        <div className="header-left">
          <div className="logo-mark" aria-hidden>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FabricAI logo">
              <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#2F6BFF" />
              <path d="M7 12c2 2 6 2 8 0" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="10" r="0.9" fill="white" />
              <circle cx="12" cy="9" r="0.9" fill="white" />
              <circle cx="16" cy="10" r="0.9" fill="white" />
            </svg>
          </div>

          <div className="brand">
            <div className="brand-name">FabricAI</div>
          </div>
        </div>
        <div className="mobile-nav-wrapper">
          <input type="checkbox" id="nav-toggle" className="nav-toggle" />

          <label htmlFor="nav-toggle" className="hamburger">
            <span></span>
            <span></span>
            <span></span>
          </label>

          <nav className="header-nav">
            <ul>
              <li>
                <NavLink to="/" end className={ ({ isActive }) => isActive ? "active" : "" }>
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink to="/analysis" end className={ ({ isActive }) => isActive ? "active" : "" }>
                  Analysis
                </NavLink>
              </li>
              <li>
                <NavLink to="/upload" end className={ ({ isActive }) => isActive ? "active" : "" }>
                  Upload
                </NavLink>
              </li>
              <li>
                <NavLink to="/view" end className={ ({ isActive }) => isActive ? "active" : "" }>
                  List
                </NavLink>
              </li>
              <li>
                <NavLink to="/search" end className={ ({ isActive }) => isActive ? "active" : "" }>
                  Search
                </NavLink>
              </li>
              <li>
                <NavLink to="/chat" end className={ ({ isActive }) => isActive ? "active" : "" }>
                  Chat
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>

        <div className="action">
          {/* <div id="theme"> <FaRegMoon /></div> */}
        </div>
      </header>

      <main className="main-content">
        <Routing />
      </main>

      <Footer />
    </div>
  );
};

export default App;
