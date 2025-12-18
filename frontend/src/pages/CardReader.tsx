import { useState } from "react";
import * as htmlToImage from "html-to-image";
import { FULL_API_URL } from "@/constants";

const CardReader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (f: File | null) => {
    setFile(f);
    setResult(null);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type.startsWith("image/")) {
      handleFile(droppedFile);
    }
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`${FULL_API_URL}/read-card`, {
      method: "POST",
      body: fd,
    });

    setResult(await res.json());
    setLoading(false);
  };

  const downloadCard = async () => {
    const node = document.getElementById("card-preview");
    if (!node) return;

    const dataUrl = await htmlToImage.toPng(node);
    const link = document.createElement("a");
    link.download = "generated-card.png";
    link.href = dataUrl;
    link.click();
  };

  return (
    <div style={styles.wrapper}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;700&display=swap');
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .upload-zone {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .upload-zone:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(255, 107, 53, 0.2);
        }
        
        .card-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .btn-primary {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(255, 107, 53, 0.3);
        }
        
        .btn-primary::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s;
        }
        
        .btn-primary:hover::before {
          left: 100%;
        }
        
        .result-enter {
          animation: slideUp 0.6s ease-out;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <h1 style={styles.title}>Card Reader</h1>
          <p style={styles.subtitle}>Extract information instantly from ID cards</p>
        </div>

        {/* Upload Zone */}
        {!preview ? (
          <div
            className="upload-zone"
            style={{
              ...styles.uploadZone,
              ...(isDragging ? styles.uploadZoneDragging : {}),
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              style={styles.fileInput}
              id="file-upload"
            />

            <label htmlFor="file-upload" style={styles.uploadLabel}>
              <div style={styles.uploadIcon}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3 style={styles.uploadTitle}>
                {isDragging ? "Drop your card here" : "Upload Card Image"}
              </h3>
              <p style={styles.uploadText}>
                Drag and drop or click to browse
              </p>
              <div style={styles.uploadHint}>
                Supports JPG, PNG, WEBP
              </div>
            </label>
          </div>
        ) : (
          <div className="result-enter">
            {/* Preview Card */}
            <div className="card-float" style={styles.previewCard}>
              <img src={preview} style={styles.previewImage} alt="Card preview" />
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setResult(null);
                }}
                style={styles.removeBtn}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Extract Button */}
            {!result && (
              <button
                className="btn-primary"
                onClick={submit}
                disabled={loading}
                style={styles.extractBtn}
              >
                {loading ? (
                  <span style={styles.loadingContent}>
                    <span style={styles.spinner}></span>
                    Processing...
                  </span>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Extract Information
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="result-enter" style={styles.resultsSection}>
            <CardPreview data={result} />

            <button
              className="btn-primary"
              onClick={downloadCard}
              style={styles.downloadBtn}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Card Image
            </button>

            <div style={styles.privacyNote}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              We do not store your data. Everything runs only during this session.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CardPreview = ({ data }: { data: any }) => (
  <div id="card-preview" style={styles.card}>
    <div style={styles.cardHeader}>
      <div style={styles.cardType}>{data.type} CARD</div>
      <div style={styles.cardChip}>
        <div style={styles.chipLine}></div>
        <div style={styles.chipLine}></div>
        <div style={styles.chipLine}></div>
      </div>
    </div>

    <div style={styles.cardBody}>
      <div style={styles.cardField}>
        <div style={styles.fieldLabel}>Full Name</div>
        <div style={styles.fieldValue}>{data.name || "—"}</div>
      </div>

      <div style={styles.cardRow}>
        <div style={styles.cardField}>
          <div style={styles.fieldLabel}>ID Number</div>
          <div style={styles.fieldValue}>{data.id_number || "—"}</div>
        </div>

        <div style={styles.cardField}>
          <div style={styles.fieldLabel}>Date of Birth</div>
          <div style={styles.fieldValue}>{data.dob || "—"}</div>
        </div>
      </div>
    </div>

    <div style={styles.cardFooter}>
      <div style={styles.securityPattern}></div>
    </div>
  </div>
);

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
    marginBottom: 48,
  },
  iconWrapper: {
    display: "inline-flex",
    padding: 16,
    background: "rgba(255, 107, 53, 0.1)",
    borderRadius: 20,
    marginBottom: 24,
    animation: "pulse 3s ease-in-out infinite",
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
    fontWeight: 400,
  },
  uploadZone: {
    position: "relative" as const,
    padding: 60,
    border: "2px dashed rgba(255, 107, 53, 0.3)",
    borderRadius: 24,
    background: "rgba(255, 107, 53, 0.03)",
    cursor: "pointer",
    textAlign: "center",
  },
  uploadZoneDragging: {
    borderColor: "#FF6B35",
    background: "rgba(255, 107, 53, 0.08)",
    transform: "scale(1.02)",
  },
  fileInput: {
    display: "none",
  },
  uploadLabel: {
    cursor: "pointer",
    display: "block",
  },
  uploadIcon: {
    color: "#FF6B35",
    marginBottom: 24,
  },
  uploadTitle: {
    fontSize: 24,
    fontFamily: "'Instrument Serif', serif",
    fontWeight: 400,
    color: "#fff",
    margin: "0 0 8px 0",
  },
  uploadText: {
    fontSize: 15,
    color: "#999",
    margin: "0 0 20px 0",
  },
  uploadHint: {
    display: "inline-block",
    padding: "6px 16px",
    background: "rgba(255, 107, 53, 0.1)",
    borderRadius: 20,
    fontSize: 13,
    color: "#FF6B35",
    fontWeight: 500,
  },
  previewCard: {
    position: "relative" as const,
    marginBottom: 24,
    borderRadius: 20,
    overflow: "hidden",
    background: "#1a1a1a",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
  },
  previewImage: {
    width: "100%",
    display: "block",
  },
  removeBtn: {
    position: "absolute" as const,
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(0, 0, 0, 0.7)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  },
  extractBtn: {
    width: "100%",
    padding: "18px 32px",
    background: "linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 16,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingContent: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  spinner: {
    width: 20,
    height: 20,
    border: "3px solid rgba(255, 255, 255, 0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    display: "inline-block",
  },
  resultsSection: {
    marginTop: 32,
  },
  card: {
    padding: 32,
    borderRadius: 20,
    background: "linear-gradient(135deg, #1a1a1a 0%, #252525 100%)",
    border: "1px solid rgba(255, 107, 53, 0.2)",
    marginBottom: 24,
    position: "relative" as const,
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
    paddingBottom: 20,
    borderBottom: "1px solid rgba(255, 107, 53, 0.2)",
  },
  cardType: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#FF6B35",
    textTransform: "uppercase" as const,
  },
  cardChip: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  chipLine: {
    width: 32,
    height: 3,
    background: "linear-gradient(90deg, #FF6B35 0%, #F7931E 100%)",
    borderRadius: 2,
  },
  cardBody: {
    marginBottom: 24,
  },
  cardRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  cardField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.05em",
    color: "#888",
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 18,
    fontFamily: "'Instrument Serif', serif",
    color: "#fff",
    fontWeight: 400,
  },
  cardFooter: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    background: "linear-gradient(90deg, #FF6B35 0%, #F7931E 50%, #FF6B35 100%)",
    opacity: 0.5,
  },
  securityPattern: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 11px)",
  },
  downloadBtn: {
    width: "100%",
    padding: "16px 32px",
    background: "rgba(255, 107, 53, 0.1)",
    color: "#FF6B35",
    border: "1px solid rgba(255, 107, 53, 0.3)",
    borderRadius: 16,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  privacyNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    padding: "16px 20px",
    background: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.05)",
  },
};

export default CardReader;
