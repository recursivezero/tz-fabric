import { useNavigate } from "react-router-dom";

const styles: any = {
  wrapper: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)",
    padding: "60px 20px",
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  },
  container: {
    maxWidth: 520,
    margin: "0 auto",
  },
  header: {
    textAlign: "center",
    marginBottom: 56,
  },
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 48,
    fontWeight: 400,
    margin: "0 0 12px 0",
    background: "linear-gradient(135deg, #fff 0%, #aaa 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    margin: 0,
  },
  buttonGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  primaryBtn: {
    padding: "20px 32px",
    background: "linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 18,
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "20px 32px",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: 18,
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
  },
};

const Reader = () => {
  const navigate = useNavigate();

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Card Reader</h1>
          <p style={styles.subtitle}>
            Select the document type to continue
          </p>
        </div>

        <div style={styles.buttonGroup}>
          <button
            style={styles.primaryBtn}
            onClick={() => navigate("/reader/pan")}
          >
            PAN Card
          </button>

          <button
            style={styles.secondaryBtn}
            onClick={() => navigate("/reader/adhaar")}
          >
            Aadhaar Card
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reader;
