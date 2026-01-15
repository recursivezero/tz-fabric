import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { useNavigate } from "react-router-dom";

import * as htmlToImage from "html-to-image";
import { FULL_API_URL } from "@/constants";



type PanResult = {
  type: string;
  name: string;
  father_name: string;
  dob: string;
  pan_number: string;
};
type Point = { x: number; y: number };
type Area = { x: number; y: number; width: number; height: number };
const CardReader = () => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<PanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);

  // react-easy-crop state
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handleFile = (f: File | null) => {
    setFile(f);
    setResult(null);
    setCroppedImage(null);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
      setShowCropper(true);
      // Reset crop state
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type.startsWith("image/")) {
      handleFile(droppedFile);
    }
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async (): Promise<string | null> => {
    if (!preview || !croppedAreaPixels) return null;

    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(null);
          return;
        }

        // Set canvas size to the cropped area
        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        // Draw the cropped image
        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );

        // Convert to data URL
        const croppedDataUrl = canvas.toDataURL("image/jpeg");
        resolve(croppedDataUrl);
      };
      image.src = preview;
    });
  };

  const handleApplyCrop = async () => {
    const croppedDataUrl = await createCroppedImage();
    if (croppedDataUrl) {
      setCroppedImage(croppedDataUrl);
      setShowCropper(false);
    }
  };

  const handleRecrop = () => {
    setShowCropper(true);
    setCroppedImage(null);
  };

  const dataURLtoFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const submit = async () => {
    if (!croppedImage && !file) return;
    setLoading(true);

    const fd = new FormData();

    // Use cropped image if available, otherwise use original file
    if (croppedImage) {
      const croppedFile = dataURLtoFile(croppedImage, "pan-card.png");
      fd.append("file", croppedFile);
    } else if (file) {
      fd.append("file", file);
    }

    try {
      const res = await fetch(`${FULL_API_URL}/pan`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("Error processing card:", error);
      alert("Failed to process card. Please try again.");
    } finally {
      setLoading(false);
    }
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

  const resetUpload = () => {
    setFile(null);
    setPreview(null);
    setCroppedImage(null);
    setResult(null);
    setShowCropper(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
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
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes watermarkFlow {
          0% { 
            transform: translateX(-100%) rotate(-5deg);
            opacity: 0.1;
          }
          50% {
            opacity: 0.3;
          }
          100% { 
            transform: translateX(100%) rotate(5deg);
            opacity: 0.1;
          }
        }
        
        @keyframes watermarkPulse {
          0%, 100% { 
            transform: scale(1) rotate(0deg);
            opacity: 0.15;
          }
          50% { 
            transform: scale(1.05) rotate(2deg);
            opacity: 0.25;
          }
        }
        
        .upload-zone {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .upload-zone:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(255, 107, 53, 0.2);
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
        .card-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            rgba(255,255,255,0.08) 25%,
            rgba(255,255,255,0.25) 37%,
            rgba(255,255,255,0.08) 63%
          );
          background-size: 200% 100%;
          animation: shimmer 1.4s linear infinite;
          pointer-events: none;
          border-radius: 18px;
        }

        
        .btn-primary:hover::before {
          left: 100%;
        }
        
        .result-enter {
          animation: slideUp 0.6s ease-out;
        }
        
        .watermark-animated {
          animation: watermarkPulse 4s ease-in-out infinite;
        }
        
        .title-shimmer {
          background: linear-gradient(
            90deg,
            #1a1a2e 0%,
            #FF6B35 25%,
            #FFD700 50%,
            #FF6B35 75%,
            #1a1a2e 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2s linear infinite;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #FF6B35;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(255, 107, 53, 0.4);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #FF6B35;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(255, 107, 53, 0.4);
        }
      `}</style>

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div
            style={{
              ...styles.iconWrapper,
              cursor: "pointer",
              transform: hovered ? "scale(1.06)" : "scale(1)",
              boxShadow: hovered
                ? "0 12px 40px rgba(255, 107, 53, 0.35)"
                : "none",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => navigate("/reader")}
            title="Back to Reader"
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FF6B35"
              strokeWidth="2"
            >
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>


          <h1 className={loading ? "title-shimmer" : ""} style={styles.title}>
            {loading ? "Processing Your Card..." : "PAN Card Reader"}
          </h1>
          <p style={styles.subtitle}>
            {loading ? "Extracting information with AI..." : "Extract information instantly from ID cards"}
          </p>
          <div style={styles.privacyNote}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>
              Your image is processed only in memory during this session.
              We do <strong>not</strong> store or save images or share data.
            </span>
          </div>
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
                {isDragging ? "Drop your card here" : "Upload PAN Card Image"}
              </h3>
              <p style={styles.uploadText}>
                Drag and drop or click to browse
              </p>
            </label>
          </div>
        ) : (
          <>
            {/* IMAGE CROPPER */}
            {showCropper && (
              <div style={styles.cropperOverlay}>
                <div style={styles.cropperContainer}>
                  <h3 style={styles.cropperTitle}>✂️ Crop Your Card</h3>
                  <p style={styles.cropperSubtitle}>
                    Pan • Pinch to zoom • Drag to reposition
                  </p>

                  <div style={styles.cropperWrapper}>
                    <Cropper
                      image={preview}
                      crop={crop}
                      zoom={zoom}
                      aspect={16 / 10}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                      style={{
                        containerStyle: styles.reactEasyCropContainer,
                        mediaStyle: styles.reactEasyCropMedia,
                        cropAreaStyle: styles.reactEasyCropArea,
                      }}
                    />
                  </div>

                  {/* Zoom Control */}
                  <div style={styles.zoomControl}>
                    <label style={styles.zoomLabel}>Zoom</label>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      style={styles.zoomSlider}
                    />
                    <span style={styles.zoomValue}>{zoom.toFixed(1)}x</span>
                  </div>

                  <div style={styles.cropperActions}>
                    <button onClick={resetUpload} style={styles.cancelBtn}>
                      ❌ Cancel
                    </button>
                    <button onClick={handleApplyCrop} style={styles.cropBtn}>
                      ✓ Apply Crop
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CROPPED IMAGE PREVIEW */}
            {croppedImage && !showCropper && (
              <div className="result-enter">
                <div style={styles.previewCard}>
                  <img
                    src={croppedImage}
                    style={styles.previewImage}
                    alt="Cropped card"
                  />
                  <div style={styles.actionButtons}>
                    <button onClick={handleRecrop} style={styles.recropBtn}>
                      ✂️ Re-crop
                    </button>
                    <button onClick={resetUpload} style={styles.removeBtn}>
                      🗑️ Remove
                    </button>
                  </div>
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
                        Extract Details
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Results */}
        {(loading || result) && (
          <div className="result-enter" style={styles.resultsSection}>
            <CardPreview data={result} loading={loading} />

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

            <button
              onClick={resetUpload}
              style={styles.newUploadBtn}
            >
              📤 Upload New PAN Card
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

type CardPreviewProps = {
  data?: PanResult | null;
  loading: boolean;
};

const SKELETON = "████████";

const CardPreview = ({ data, loading }: CardPreviewProps) => {
  const timestamp = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
    .format(new Date())
    .replace(/\b(am|pm)\b/, (m) => m.toUpperCase());

  return (
    <div
      id="card-preview"
      style={{
        ...styles.card,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 🌊 Shimmer Overlay */}
      {loading && <div className="card-shimmer" />}

      {/* Creative Animated Watermark */}
      <div style={styles.watermarkContainer}>
        <div className="watermark-animated" style={styles.watermark}>
          {/* SVG unchanged */}
        </div>
        <div style={styles.watermarkText}>Recursive Zero</div>
      </div>

      {/* Header */}
      <div style={styles.cardHeader}>
        <div style={styles.cardType}>
          {loading ? SKELETON : `${data?.type ?? "PAN"} CARD`}
        </div>

        <div style={styles.cardChip}>
          <div style={styles.chipLine} />
          <div style={styles.chipLine} />
          <div style={styles.chipLine} />
        </div>
      </div>

      {/* Body */}
      <div style={styles.cardBody}>
        <div style={styles.cardField}>
          <div style={styles.fieldLabel}>Name</div>
          <div style={styles.fieldValue}>
            {loading ? SKELETON : data?.name || "—"}
          </div>
        </div>

        <div style={styles.cardField}>
          <div style={styles.fieldLabel}>Father's Name</div>
          <div style={styles.fieldValue}>
            {loading ? SKELETON : data?.father_name || "—"}
          </div>
        </div>

        <div style={styles.cardRow}>
          <div style={styles.cardField}>
            <div style={styles.fieldLabel}>PAN Number</div>
            <div style={styles.fieldValue}>
              {loading ? SKELETON : data?.pan_number || "—"}
            </div>
          </div>

          <div style={styles.cardField}>
            <div style={styles.fieldLabel}>Date of Birth</div>
            <div style={styles.fieldValue}>
              {loading ? SKELETON : data?.dob || "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div style={styles.timestampRow}>
        <span style={styles.timestampLabel}>Generated</span>
        <span style={styles.timestampValue}>
          {loading ? SKELETON : `${timestamp} IST`}
        </span>
      </div>

      {/* Footer */}
      <div style={styles.cardFooter}>
        <div style={styles.securityPattern} />
      </div>
    </div>
  );
};


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
    transition: "all 0.2s ease",
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
  previewCard: {
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
  actionButtons: {
    display: "flex",
    gap: 12,
    padding: 16,
  },
  recropBtn: {
    flex: 1,
    padding: "12px 20px",
    background: "rgba(255, 107, 53, 0.1)",
    color: "#FF6B35",
    border: "1px solid rgba(255, 107, 53, 0.3)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  removeBtn: {
    flex: 1,
    padding: "12px 20px",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
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
  watermarkContainer: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none" as const,
    overflow: "hidden",
  },
  watermark: {
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    opacity: 0.15,
  },
  watermarkSvg: {
    display: "block",
    filter: "drop-shadow(0 0 10px rgba(255, 107, 53, 0.2))",
  },
  watermarkText: {
    position: "absolute" as const,
    top: 16,
    right: 16,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.15em",
    color: "rgba(255, 107, 53, 0.3)",
    textTransform: "uppercase" as const,
    fontFamily: "'DM Sans', sans-serif",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
    paddingBottom: 20,
    borderBottom: "1px solid rgba(255, 107, 53, 0.2)",
    position: "relative" as const,
    zIndex: 1,
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
    position: "relative" as const,
    zIndex: 1,
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
    marginBottom: 12,
    transition: "all 0.2s ease",
  },
  newUploadBtn: {
    width: "100%",
    padding: "16px 32px",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginBottom: 20,
  },
  privacyNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: 16,
    color: "#bb0707ff",
    textAlign: "center",
    padding: "16px 20px",
    background: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.05)",
  },

  // Cropper styles
  cropperOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.95)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  cropperContainer: {
    background: "#1a1a1a",
    borderRadius: 20,
    padding: 24,
    maxWidth: 600,
    width: "100%",
  },
  cropperTitle: {
    fontSize: 24,
    fontFamily: "'Instrument Serif', serif",
    color: "#fff",
    margin: "0 0 8px 0",
    textAlign: "center",
  },
  cropperSubtitle: {
    fontSize: 14,
    color: "#888",
    margin: "0 0 24px 0",
    textAlign: "center",
  },
  cropperWrapper: {
    position: "relative" as const,
    width: "100%",
    height: 400,
    background: "#000",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
  },
  reactEasyCropContainer: {
    background: "#000",
  },
  reactEasyCropMedia: {},
  reactEasyCropArea: {
    border: "2px solid #FF6B35",
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
  },
  zoomControl: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    padding: "12px 16px",
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: 12,
  },
  zoomLabel: {
    fontSize: 14,
    color: "#888",
    fontWeight: 600,
    minWidth: 50,
  },
  timestampRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    marginTop: 12,
    borderTop: "1px dashed rgba(255, 107, 53, 0.25)",
    fontFamily: "'DM Sans', sans-serif",
    position: "relative" as const,
    zIndex: 1,
  },

  timestampLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "rgba(255, 107, 53, 0.6)",
  },

  timestampValue: {
    fontSize: 12,
    fontWeight: 500,
    color: "#ddd",
    letterSpacing: "0.04em",
  },

  zoomSlider: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    background: "rgba(255, 255, 255, 0.1)",
    outline: "none",
    appearance: "none" as const,
    WebkitAppearance: "none",
    cursor: "pointer",
  },
  zoomValue: {
    fontSize: 14,
    color: "#FF6B35",
    fontWeight: 600,
    minWidth: 45,
    textAlign: "right" as const,
  },
  cropperActions: {
    display: "flex",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: "14px 24px",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  cropBtn: {
    flex: 1,
    padding: "14px 24px",
    background: "linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

};

export default CardReader;