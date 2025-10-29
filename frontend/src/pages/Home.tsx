import { Link } from "react-router-dom";
import "../styles/Home.css";

export default function Home() {
  return (
    <div className="homeV2">
      <div className="homeV2__bg" />

      <main className="homeV2__container">
        <header className="homeV2__hero">
          <h1 className="homeV2__title">
            Advanced Fabric Analysis
            <span className="homeV2__titleAccent">Powered by AI</span>
          </h1>
          <p className="homeV2__subtitle">
            Upload fabric images and get instant, professional analysis including fiber
            composition, weave patterns, quality assessment, and detailed technical
            specifications.
          </p>
        </header>

        <section className="homeV2__features">
          <Link to="/upload" className="featureCard featureCard--link">
            <div className="featureCard__icon" aria-hidden>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M8.5 9L12 5.5L15.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className="featureCard__title">Easy Upload</h3>
            <p className="featureCard__text">
              Drag &amp; drop or click to upload high-resolution fabric images for instant analysis.
            </p>
          </Link>

          <Link to="/describe" className="featureCard featureCard--link">
            <div className="featureCard__icon" aria-hidden>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L4 14h7l-1 8L20 9h-7l0-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="featureCard__title">Real-time Results</h3>
            <p className="featureCard__text">
              Get comprehensive analysis results in seconds with detailed technical specifications.
            </p>
          </Link>

          <Link to="/chat" className="featureCard featureCard--link">
            <div className="featureCard__icon" aria-hidden>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M7 19l-3 3v-4a8 8 0 1 1 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="featureCard__title">AI Chat Assistant</h3>
            <p className="featureCard__text">
              Discuss analysis with our assistant and export conversations.
            </p>
          </Link>
        </section>

        <section className="homeV2__steps">
          <h2 className="steps__heading">How to Use FabricAI</h2>

          <div className="steps__grid">
            <Link to="/upload" className="stepCard stepCard--link">
              <div className="stepCard__badge">1</div>
              <h4 className="stepCard__title">Upload Image</h4>
              <p className="stepCard__text">Upload clear, well-lit fabric images</p>
              <span className="stepCard__link">Go to Upload →</span>
            </Link>

            <Link to="/analyse" className="stepCard stepCard--link">
              <div className="stepCard__badge">2</div>
              <h4 className="stepCard__title">Choose Analysis</h4>
              <p className="stepCard__text">Select short or long analysis mode</p>
              <span className="stepCard__link">Open Analyzer →</span>
            </Link>

            <Link to="/view" className="stepCard stepCard--link">
              <div className="stepCard__badge">3</div>
              <h4 className="stepCard__title">Review Results</h4>
              <p className="stepCard__text">Get detailed fabric analysis instantly</p>
              <span className="stepCard__link">View Saved →</span>
            </Link>

            <Link to="/chat" className="stepCard stepCard--link">
              <div className="stepCard__badge">4</div>
              <h4 className="stepCard__title">Chat &amp; Export</h4>
              <p className="stepCard__text">Discuss with AI and download reports</p>
              <span className="stepCard__link">Open Chat →</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
