import React from "react";
import "./App.css";
import { Routing } from "./Routing";

const App: React.FC = () => {
  return (
    <div className="app-wrapper">
      <header className="site-header">
        <div className="header-left">
          <div className="logo-mark" aria-hidden>
            {/* Inline SVG logo: small rounded blue square with a white stitch icon */}
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FabricAI logo">
              <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#2F6BFF" />
              <path d="M7 12c2 2 6 2 8 0" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="8" cy="10" r="0.9" fill="white"/>
              <circle cx="12" cy="9" r="0.9" fill="white"/>
              <circle cx="16" cy="10" r="0.9" fill="white"/>
            </svg>
          </div>

          <div className="brand">
            <div className="brand-name">FabricAI</div>
          </div>
        </div>
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/describe">Describe</a></li>
            <li><a href="/upload">Upload</a></li>
            <li><a href="/view">List</a></li>
            <li><a href="/search">Search</a></li>
            <li><a href="/chat">Chat</a></li>
          </ul>
        </nav>
      </header>

      <main className="main-content">
        <Routing />
      </main>
    </div>
  );
};

export default App;
