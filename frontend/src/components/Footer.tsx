import { Link } from "react-router-dom";
import "../styles/Footer.css";

export default function Footer() {

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="footer__inner">
        {/* Brand + blurb */}
        <div className="footer__brand">
          <div className="footer__logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#2F6BFF" />
              <path d="M7 12c2 2 6 2 8 0" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="10" r="0.9" fill="white" />
              <circle cx="12" cy="9" r="0.9" fill="white" />
              <circle cx="16" cy="10" r="0.9" fill="white" />
            </svg>
          </div>
          <div>
            <div className="footer__title">FabricAI</div>
            <p className="footer__desc">
              Professional fabric analysis powered by artificial intelligence.
              Trusted by textile professionals worldwide.
            </p>
            <a
              className="footer__github"
              href="https://github.com/recursivezero/tz-fabric"
              target="_blank"
              rel="noreferrer"
              aria-label="tz-fabric on GitHub"
            >
              {/* GitHub icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.35-1.75-1.35-1.75-1.1-.75.08-.73.08-.73 1.22.09 1.86 1.25 1.86 1.25 1.08 1.86 2.84 1.32 3.53 1.01.11-.78.42-1.32.76-1.63-2.66-.3-5.46-1.33-5.46-5.92 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.65.24 2.87.12 3.17.78.84 1.24 1.91 1.24 3.22 0 4.6-2.8 5.61-5.47 5.91.43.37.81 1.1.81 2.22v3.29c0 .32.21.69.82.58A12 12 0 0 0 12 .5Z" />
              </svg>
              <span>tz-fabric</span>
            </a>
          </div>
        </div>

        <div className="footer__cols">
          <div className="footer__col">
            <h4>Product</h4>
            <ul>
              <li><Link to="/features">Features</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/api">API</Link></li>
            </ul>
          </div>
          <div className="footer__col">
            <h4>Support</h4>
            <ul>
              <li><Link to="/docs">Documentation</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/help">Help Center</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <hr className="footer__rule" />
      <div className="footer__copyright">
        © {new Date().getFullYear()} ·  <a href="https://recursivezero.com" target="_blank"> Recursive Zero Pvt Ltd </a>.  All Rights Reserved.
      </div>
    </footer>
  );
}
