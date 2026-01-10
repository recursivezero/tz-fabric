"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";

import * as htmlToImage from "html-to-image";
import { FULL_API_URL } from "@/constants";

/* =======================
  TYPES
======================= */

type AadhaarSide = "front" | "back";
type Point = { x: number; y: number };
type Area = { x: number; y: number; width: number; height: number };

type AadhaarFrontResult = {
  type: "AADHAAR";
  name: string;
  dob: string;
  gender: string;
  aadhaar_number: string;
  address: string;
};

type AadhaarBackResult = {
  type: "AADHAAR";
  name: string;
  dob: string;
  gender: string;
  aadhaar_number: string;
  address: string;
};

type AadhaarResult = AadhaarFrontResult | AadhaarBackResult;

/* =======================
   COMPONENT
======================= */

const AadhaarCardReader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AadhaarResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [side, setSide] = useState<AadhaarSide>("front");
  const [showCropper, setShowCropper] = useState(false);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);


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
      setOriginalPreview(url);   // 🔥 ADD
      setPreview(url);
      setShowCropper(true);
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

  const onCropComplete = useCallback(
    (_: Area, croppedPixels: Area) => {
      setCroppedAreaPixels(croppedPixels);
    },
    []
  );


  const createCroppedImage = async (): Promise<string | null> => {
    if (!originalPreview || !croppedAreaPixels) return null;

    return new Promise((resolve) => {
      const image = new Image();
      image.src = originalPreview!; 
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);

        canvas.width = Math.round(croppedAreaPixels.width);
        canvas.height = Math.round(croppedAreaPixels.height);

        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          canvas.width,
          canvas.height
        );

        resolve(canvas.toDataURL("image/jpeg"));
      };
      image.src = originalPreview;
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
    setPreview(originalPreview); // 🔥 restore original
    setCroppedImage(null);
    setShowCropper(true);
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
      const croppedFile = dataURLtoFile(croppedImage, `aadhaar-${side}.png`);
      fd.append("file", croppedFile);
    } else if (file) {
      fd.append("file", file);
    }

    // Send side as string parameter
    fd.append("side", side);

    try {
      const res = await fetch(`${FULL_API_URL}/adhaar`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("Error processing Aadhaar:", error);
      alert("Failed to process Aadhaar card. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadCard = async () => {
    const node = document.getElementById("card-preview");
    if (!node) return;

    const dataUrl = await htmlToImage.toPng(node);
    const link = document.createElement("a");
    link.download = `aadhaar-card-${side}.png`;
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
      <div style={styles.container}>
        <h1 style={styles.title}>Aadhaar Card Reader</h1>
        <p style={styles.subtitle}>Choose side → upload aadhar card → crop → extract</p>
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

        {/* SIDE SELECTOR */}
        <div style={styles.sideSelector}>
          <button
            onClick={() => setSide("front")}
            style={{
              ...styles.sideBtn,
              ...(side === "front" ? styles.sideBtnActive : {}),
            }}
          >
            Aadhaar Front
          </button>
          <button
            onClick={() => setSide("back")}
            style={{
              ...styles.sideBtn,
              ...(side === "back" ? styles.sideBtnActive : {}),
            }}
          >
            Aadhaar Back
          </button>
        </div>

        {/* UPLOAD */}
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
            </label>
          </div>
        ) : (
          <>
            {/* IMAGE CROPPER */}
            {showCropper && (
              <div style={styles.cropperOverlay}>
                <div style={styles.cropperContainer}>
                  <h3 style={styles.cropperTitle}>✂️ Crop Your Aadhaar Card</h3>
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
              <div style={styles.previewCard}>
                <img src={croppedImage} style={styles.previewImage} alt="Cropped Aadhaar" />
                <div style={styles.actionButtons}>
                  <button onClick={handleRecrop} style={styles.recropBtn}>
                    ✂️ Re-crop
                  </button>
                  <button onClick={resetUpload} style={styles.removeBtn}>
                    🗑️ Remove
                  </button>
                </div>
                <button onClick={submit} disabled={loading} style={styles.extractBtn}>
                  {loading ? "Processing..." : "Extract Information"}
                </button>
              </div>
            )}
          </>
        )}

        {/* RESULT */}
        {result && (
          <>
            <AadhaarCardPreview data={result} side={side} />
            <button onClick={downloadCard} style={styles.downloadBtn}>
              💾 Download Card Image
            </button>
            <button onClick={resetUpload} style={styles.newUploadBtn}>
              📤 Upload New Card
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* =======================
   CARD PREVIEW
======================= */

const AadhaarCardPreview = ({
  data,
  side,
}: {
  data: AadhaarResult;
  side: AadhaarSide;
}) => (
  <div id="card-preview" style={styles.card}>
    <div style={styles.watermark}>Recursive Zero</div>

    <div style={styles.cardHeader}>
      <div style={styles.cardType}>AADHAAR CARD</div>
    </div>

    <div style={styles.cardBody}>
      {side === "front" && (
        <>
          <Field label="Name" value={(data as AadhaarFrontResult).name} />
          <Field label="DOB" value={(data as AadhaarFrontResult).dob} />
          <Field label="Gender" value={(data as AadhaarFrontResult).gender} />
          <Field
            label="Aadhaar Number"
            value={(data as AadhaarFrontResult).aadhaar_number}
          />
        </>
      )}

      {side === "back" && (
        <Field label="Address" value={(data as AadhaarBackResult).address} />
      )}
    </div>
  </div>
);

const Field = ({ label, value }: { label: string; value?: string }) => (
  <div style={styles.cardField}>
    <div style={styles.fieldLabel}>{label}</div>
    <div style={styles.fieldValue}>{value || "—"}</div>
  </div>
);

/* =======================
   STYLES
======================= */

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
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 48,
    fontWeight: 400,
    margin: "0 0 12px 0",
    background: "linear-gradient(135deg, #fff 0%, #aaa 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.02em",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    margin: "0 0 32px 0",
    fontWeight: 400,
    textAlign: "center",
  },
  sideSelector: {
    display: "flex",
    gap: 12,
    marginBottom: 24,
    padding: 4,
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
  },
  sideBtn: {
    flex: 1,
    padding: "12px 20px",
    background: "transparent",
    color: "#888",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  sideBtnActive: {
    background: "linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)",
    color: "#fff",
  },
  uploadZone: {
    position: "relative" as const,
    padding: 60,
    border: "2px dashed rgba(255, 107, 53, 0.3)",
    borderRadius: 24,
    background: "rgba(255, 107, 53, 0.03)",
    cursor: "pointer",
    textAlign: "center",
    marginBottom: 20,
    transition: "all 0.3s ease",
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
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 20,
    color: "#fff",
    margin: "0 0 8px 0",
    fontWeight: 600,
  },
  uploadText: {
    fontSize: 16,
    color: "#999",
    margin: 0,
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
    marginTop: 16,
    transition: "all 0.2s ease",
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
  watermark: {
    position: "absolute" as const,
    top: 16,
    right: 16,
    fontSize: 10,
    color: "rgba(255, 107, 53, 0.3)",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
  cardHeader: {
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
  cardBody: {
    marginBottom: 0,
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
  privacyNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    fontSize: 16,
    color: "#b70d0dff",
    textAlign: "center",
    padding: "16px 20px",
    background: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.05)",
    marginBottom: 24,
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

export default AadhaarCardReader;