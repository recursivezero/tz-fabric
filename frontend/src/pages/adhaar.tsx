import { useState, useRef } from "react";
import * as htmlToImage from "html-to-image";
import { FULL_API_URL } from "@/constants";

/* =======================
  TYPES
======================= */

type AadhaarSide = "front" | "back";

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

type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);

  const handleFile = (f: File | null) => {
    setFile(f);
    setResult(null);
    setCroppedImage(null);
    if (f) {
      const url = URL.createObjectURL(f);
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
      const res = await fetch(`${FULL_API_URL}/read-aadhaar`, {
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
    setCropArea(null);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <h1 style={styles.title}>Aadhaar Card Reader</h1>
        <p style={styles.subtitle}>Choose side → upload → crop → extract</p>

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
            {showCropper && !croppedImage && (
              <ImageCropper
                imageUrl={preview}
                onCropComplete={(croppedDataUrl) => {
                  setCroppedImage(croppedDataUrl);
                  setShowCropper(false);
                }}
                onCancel={() => {
                  resetUpload();
                }}
              />
            )}

            {/* CROPPED IMAGE PREVIEW */}
            {croppedImage && (
              <div style={styles.previewCard}>
                <img src={croppedImage} style={styles.previewImage} alt="Cropped Aadhaar" />
                <div style={styles.actionButtons}>
                  <button onClick={() => setShowCropper(true)} style={styles.recropBtn}>
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
   IMAGE CROPPER
======================= */

const ImageCropper = ({
  imageUrl,
  onCropComplete,
  onCancel,
}: {
  imageUrl: string;
  onCropComplete: (croppedDataUrl: string) => void;
  onCancel: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const loadImage = () => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 480;
      const scale = maxWidth / img.width;
      const displayWidth = maxWidth;
      const displayHeight = img.height * scale;

      setImageDimensions({ width: displayWidth, height: displayHeight });

      // Initialize crop area (80% of image, centered)
      const cropWidth = displayWidth * 0.8;
      const cropHeight = displayHeight * 0.8;
      setCropArea({
        x: (displayWidth - cropWidth) / 2,
        y: (displayHeight - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight,
      });

      if (imgRef.current) {
        imgRef.current.src = imageUrl;
      }
    };
    img.src = imageUrl;
  };

  useState(() => {
    loadImage();
  });

  const handleMouseDown = (e: React.MouseEvent, action: string) => {
    e.preventDefault();
    if (action === "move") {
      setIsDragging(true);
      setDragStart({ x: e.clientX - cropArea.x, y: e.clientY - cropArea.y });
    } else {
      setIsResizing(action);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(e.clientX - dragStart.x, imageDimensions.width - cropArea.width));
      const newY = Math.max(0, Math.min(e.clientY - dragStart.y, imageDimensions.height - cropArea.height));
      setCropArea({ ...cropArea, x: newX, y: newY });
    } else if (isResizing) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      let newArea = { ...cropArea };

      if (isResizing.includes("e")) {
        newArea.width = Math.max(50, Math.min(cropArea.width + deltaX, imageDimensions.width - cropArea.x));
      }
      if (isResizing.includes("w")) {
        const newWidth = Math.max(50, cropArea.width - deltaX);
        const newX = Math.max(0, cropArea.x + (cropArea.width - newWidth));
        newArea.x = newX;
        newArea.width = newWidth;
      }
      if (isResizing.includes("s")) {
        newArea.height = Math.max(50, Math.min(cropArea.height + deltaY, imageDimensions.height - cropArea.y));
      }
      if (isResizing.includes("n")) {
        const newHeight = Math.max(50, cropArea.height - deltaY);
        const newY = Math.max(0, cropArea.y + (cropArea.height - newHeight));
        newArea.y = newY;
        newArea.height = newHeight;
      }

      setCropArea(newArea);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(null);
  };

  const cropImage = () => {
    const img = imgRef.current;
    if (!img || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Calculate scale factor between display size and actual image size
    const scaleX = img.naturalWidth / imageDimensions.width;
    const scaleY = img.naturalHeight / imageDimensions.height;

    // Set canvas size to cropped dimensions
    canvas.width = cropArea.width * scaleX;
    canvas.height = cropArea.height * scaleY;

    // Draw cropped image
    ctx.drawImage(
      img,
      cropArea.x * scaleX,
      cropArea.y * scaleY,
      cropArea.width * scaleX,
      cropArea.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const croppedDataUrl = canvas.toDataURL("image/png");
    onCropComplete(croppedDataUrl);
  };

  return (
    <div style={styles.cropperOverlay}>
      <div style={styles.cropperContainer}>
        <h3 style={styles.cropperTitle}>✂️ Crop Your Aadhaar Card</h3>
        <p style={styles.cropperSubtitle}>Drag to move • Resize from corners/edges</p>

        <div
          style={{
            ...styles.cropperImageContainer,
            width: imageDimensions.width,
            height: imageDimensions.height,
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={imgRef}
            style={styles.cropperImage}
            alt="Original"
          />

          {/* Overlay (darkened area outside crop) */}
          <div style={styles.cropperOverlayDark} />

          {/* Crop area */}
          <div
            style={{
              ...styles.cropBox,
              left: cropArea.x,
              top: cropArea.y,
              width: cropArea.width,
              height: cropArea.height,
            }}
            onMouseDown={(e) => handleMouseDown(e, "move")}
          >
            {/* Resize handles */}
            {["nw", "ne", "sw", "se", "n", "s", "e", "w"].map((pos) => (
              <div
                key={pos}
                style={{
                  ...styles.resizeHandle,
                  ...styles[`handle${pos.toUpperCase()}`],
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(e, pos);
                }}
              />
            ))}
          </div>
        </div>

        <div style={styles.cropperActions}>
          <button onClick={onCancel} style={styles.cancelBtn}>
            ❌ Cancel
          </button>
          <button onClick={cropImage} style={styles.cropBtn}>
            ✓ Apply Crop
          </button>
        </div>
      </div>

      {/* Hidden canvas for cropping */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
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
  cropperImageContainer: {
    position: "relative" as const,
    margin: "0 auto 24px",
    userSelect: "none" as const,
  },
  cropperImage: {
    width: "100%",
    height: "100%",
    display: "block",
    pointerEvents: "none" as const,
  },
  cropperOverlayDark: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    pointerEvents: "none" as const,
  },
  cropBox: {
    position: "absolute" as const,
    border: "2px solid #FF6B35",
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
    cursor: "move",
  },
  resizeHandle: {
    position: "absolute" as const,
    background: "#FF6B35",
    border: "2px solid #fff",
  },
  handleNW: { width: 12, height: 12, top: -6, left: -6, cursor: "nw-resize", borderRadius: "50%" },
  handleNE: { width: 12, height: 12, top: -6, right: -6, cursor: "ne-resize", borderRadius: "50%" },
  handleSW: { width: 12, height: 12, bottom: -6, left: -6, cursor: "sw-resize", borderRadius: "50%" },
  handleSE: { width: 12, height: 12, bottom: -6, right: -6, cursor: "se-resize", borderRadius: "50%" },
  handleN: { width: 40, height: 6, top: -3, left: "50%", transform: "translateX(-50%)", cursor: "n-resize", borderRadius: 3 },
  handleS: { width: 40, height: 6, bottom: -3, left: "50%", transform: "translateX(-50%)", cursor: "s-resize", borderRadius: 3 },
  handleE: { width: 6, height: 40, right: -3, top: "50%", transform: "translateY(-50%)", cursor: "e-resize", borderRadius: 3 },
  handleW: { width: 6, height: 40, left: -3, top: "50%", transform: "translateY(-50%)", cursor: "w-resize", borderRadius: 3 },
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
  },
};

export default AadhaarCardReader;