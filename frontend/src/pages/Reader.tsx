import { useNavigate } from "react-router-dom";
import { useState } from "react";

const styles: any = {
  wrapper: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)",
    padding: "60px 20px",
    fontFamily: "'DM Sans', -apple-system, sans-serif",
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
    fontFamily: "'Instrument Serif', serif",
    fontSize: 56,
    fontWeight: 400,
    margin: "0 0 16px 0",
    background: "linear-gradient(135deg, #fff 0%, #aaa 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 18,
    color: "#888",
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
    background: "linear-gradient(135deg, rgba(255, 107, 53, 0.06) 0%, rgba(247, 147, 30, 0.03) 100%)",
    border: "2px solid rgba(255, 107, 53, 0.15)",
    cursor: "pointer",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 320,
  },

  tileGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "radial-gradient(circle at 50% 50%, rgba(255, 107, 53, 0.12), transparent 70%)",
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
    filter: "drop-shadow(0 8px 24px rgba(255, 107, 53, 0.4))",
    transition: "all 0.4s ease",
  },

  tileTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: "#fff",
    marginBottom: 12,
    letterSpacing: "-0.02em",
  },

  tileDesc: {
    fontSize: 16,
    color: "#aaa",
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
      boxShadow: "0 32px 80px rgba(255, 107, 53, 0.3)",
      borderColor: "rgba(255, 107, 53, 0.5)",
      background: "linear-gradient(135deg, rgba(255, 107, 53, 0.12) 0%, rgba(247, 147, 30, 0.08) 100%)",
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
          <p style={styles.subtitle}>Choose a card to scan and extract information</p>
        </div>

        <div style={styles.tileGrid}>
          <div
            style={getTileStyle("pan")}
            onClick={() => navigate("/reader/pan")}
            onMouseEnter={() => setHoveredTile("pan")}
            onMouseLeave={() => setHoveredTile(null)}
          >
            <div style={getGlowStyle("pan")} />
            <div style={styles.tileContent}>
              <div style={getIconStyle("pan")}>🪪</div>
              <div style={styles.tileTitle}>PAN Card</div>
              <div style={styles.tileDesc}>Income Tax Department</div>
            </div>
          </div>

          <div
            style={getTileStyle("aadhaar")}
            onClick={() => navigate("/reader/adhaar")}
            onMouseEnter={() => setHoveredTile("aadhaar")}
            onMouseLeave={() => setHoveredTile(null)}
          >
            <div style={getGlowStyle("aadhaar")} />
            <div style={styles.tileContent}>
              <div style={getIconStyle("aadhaar")}>🆔</div>
              <div style={styles.tileTitle}>Aadhaar Card</div>
              <div style={styles.tileDesc}>UIDAI Identity</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reader;