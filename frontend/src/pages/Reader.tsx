import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { CSSProperties } from "react";

const styles: Record<string, CSSProperties | Record<string, CSSProperties>> = {
  wrapper: {
    minHeight: "100vh",
    background: "var(--reader-page-bg)",
    padding: "60px 20px",
    fontFamily: "var(--tz-font-body)",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  header: {
    textAlign: "center",
    marginBottom: 80,
  },
  title: {
    fontFamily: "var(--tz-font-display)",
    fontSize: "clamp(2.25rem, 6vw, 3.5rem)",
    fontWeight: 700,
    margin: "0 0 16px 0",
    color: "var(--reader-text)",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 18,
    color: "var(--reader-muted)",
    margin: 0,
  },
  tileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 40,
    maxWidth: 1000,
    margin: "0 auto",
  },

  tile: {
    padding: "60px 48px",
    borderRadius: 28,
    background: "var(--reader-tile-bg)",
    border: "2px solid var(--reader-tile-border)",
    cursor: "pointer",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 320,
    width: "100%",
    font: "inherit",
    color: "inherit",
  },

  tileGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "var(--reader-tile-glow)",
    opacity: 0,
    transition: "opacity 0.4s ease",
  },

  tileContent: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },

  tileIcon: {
    fontSize: 88,
    marginBottom: 28,
    filter: "var(--reader-icon-shadow)",
    transition: "all 0.4s ease",
  },

  tileTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: "var(--reader-text)",
    marginBottom: 12,
    letterSpacing: "-0.02em",
  },

  tileDesc: {
    fontSize: 16,
    color: "var(--reader-text-soft)",
    fontWeight: 500,
  },

  "@media (max-width: 768px)": {
    tileGrid: {
      gridTemplateColumns: "1fr",
      gap: 24,
    },
  },
};

const Reader = () => {
  const navigate = useNavigate();
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);

  const getTileStyle = (tileName: string) => ({
    ...styles.tile,
    ...(hoveredTile === tileName && {
      transform: "translateY(-12px) scale(1.03)",
      boxShadow: "var(--reader-tile-hover-shadow)",
      borderColor: "var(--reader-tile-border-hover)",
      background: "var(--reader-tile-hover-bg)",
    }),
  });

  const getGlowStyle = (tileName: string) => ({
    ...styles.tileGlow,
    opacity: hoveredTile === tileName ? 1 : 0,
  });

  const getIconStyle = (tileName: string) => ({
    ...styles.tileIcon,
    ...(hoveredTile === tileName && {
      transform: "scale(1.15) rotate(-5deg)",
    }),
  });

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Select Document Type</h1>
          <p style={styles.subtitle}>
            Choose a card to scan and extract information
          </p>
        </div>

        <div style={styles.tileGrid}>
          <button
            type="button"
            style={getTileStyle("pan")}
            onClick={() => navigate("/reader/pan")}
            onMouseEnter={() => setHoveredTile("pan")}
            onMouseLeave={() => setHoveredTile(null)}
            onFocus={() => setHoveredTile("pan")}
            onBlur={() => setHoveredTile(null)}
            aria-label="Open PAN card reader"
          >
            <div style={getGlowStyle("pan")} />
            <div style={styles.tileContent}>
              <div style={getIconStyle("pan")}>🪪</div>
              <div style={styles.tileTitle}>PAN Card</div>
              <div style={styles.tileDesc}>Income Tax Department</div>
            </div>
          </button>

          <button
            type="button"
            style={getTileStyle("aadhaar")}
            onClick={() => navigate("/reader/aadhaar")}
            onMouseEnter={() => setHoveredTile("aadhaar")}
            onMouseLeave={() => setHoveredTile(null)}
            onFocus={() => setHoveredTile("aadhaar")}
            onBlur={() => setHoveredTile(null)}
            aria-label="Open Aadhaar card reader"
          >
            <div style={getGlowStyle("aadhaar")} />
            <div style={styles.tileContent}>
              <div style={getIconStyle("aadhaar")}>🆔</div>
              <div style={styles.tileTitle}>Aadhaar Card</div>
              <div style={styles.tileDesc}>UIDAI Identity</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reader;
