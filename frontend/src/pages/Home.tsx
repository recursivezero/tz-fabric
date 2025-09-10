import { Link } from "react-router-dom";
import "../styles/Home.css";

export default function Home() {
  return (
    <div className="home">
      <div className="home__bg" />

      <main className="home__container">
        <header className="home__hero">
          <h1 className="home__title">Work with your fabric, effortlessly.</h1>
          <p className="home__sub">
            Upload & record audio, describe images with AI, and revisit your saved documents — all in one place.
          </p>
        </header>

        <section className="home__grid">
          <Link to="/upload" className="home__card">
            <div className="home__icon">🎙️</div>
            <h2 className="home__cardTitle">Upload & Record</h2>
            <p className="home__cardText">Add images and record audio notes in a single flow.</p>
            <span className="home__cta">Open →</span>
          </Link>

          <Link to="/describe" className="home__card">
            <div className="home__icon">🖼️</div>
            <h2 className="home__cardTitle">Image Description</h2>
            <p className="home__cardText">Generate short or long analyses for any fabric image.</p>
            <span className="home__cta">Describe →</span>
          </Link>

          <Link to="/view" className="home__card">
            <div className="home__icon">📂</div>
            <h2 className="home__cardTitle">Saved Documents</h2>
            <p className="home__cardText">Browse, search, and manage everything you’ve saved.</p>
            <span className="home__cta">View →</span>
          </Link>
        </section>

        <footer className="home__footer">
          <span>© {new Date().getFullYear()} Recursive Zero · Fabric Analyzer</span>
        </footer>
      </main>
    </div>
  );
}
