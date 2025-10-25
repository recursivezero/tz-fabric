import { useId, useMemo, useState, useEffect, useRef, useCallback } from "react";
import Loader from "../components/Loader";
import Notification from "../components/Notification";
import useImageSearch from "../hooks/useImageSearch";
import "../styles/FabricSearch.css";

export default function Search() {
  const { loading, error, exactMatches, runSearch, clear } = useImageSearch();
  const [file, setFile] = useState<File | null>(null);
  const [k, setK] = useState(0);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const pageSize = 4;
  const [page, setPage] = useState(1);

  const dataUrlToFile = useCallback(async (dataUrl: string, filename = "query.png"): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  }, []);

  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;

    try {
      const raw = sessionStorage.getItem("mcp_last_search");
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const maybeDataUrl = parsed?.queryPreview;
      const maybeK = parsed?.k ?? parsed?.K ?? parsed?.params?.k ?? 0;

      if (maybeDataUrl && !file) {
        didAutoRun.current = true;

        (async () => {
          try {
            const guessName = `query-${Date.now()}.png`;
            const f = await dataUrlToFile(maybeDataUrl, guessName);
            setFile(f);

            if (Number.isFinite(maybeK) && Number(maybeK) > 0) {
              setK(Number(maybeK));
            } else {
              setK(prev => (prev > 0 ? prev : 3));
            }

            await runSearch(f, Number(maybeK) || 3);
          } catch (err) {
            console.error("Auto-run search from mcp_last_search failed:", err);
            setNotification({ message: "Could not auto-run search payload.", type: "error" });
          } finally {
            try {
              sessionStorage.removeItem("mcp_last_search");
            } catch {}
            setPage(1);
          }
        })();
      }
    } catch (err) {
      console.warn("Failed to parse mcp_last_search", err);
    }
  }, [file, runSearch, dataUrlToFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPage(1);
  };

  const cleanName = (filename: string) => {
    if (!filename) return "";
    return filename.split("_")[0].split(".")[0];
  };

  const handleSearch = async () => {
    if (!file) return;
    setNotification(null);
    await runSearch(file, k);
    setPage(1);
  };

  const handleClear = () => {
    setFile(null);
    clear();
    setPage(1);
    setNotification(null);
  };

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * pageSize;
    return exactMatches.slice(start, start + pageSize);
  }, [page, exactMatches]);

  const totalPages = Math.ceil(exactMatches.length / pageSize);
  const fileid = useId();

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");
    return () => { wrapper?.classList.remove("upload-bg"); };
  }, []);

  // ---------- Lightbox / Zoom state (same behavior as list page) ----------
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const draggingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 6;
  const ZOOM_STEP = 0.2;

  const openLightbox = (src: string, caption?: string) => {
    setActiveSrc(src);
    setActiveCaption(caption ?? null);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setLightboxOpen(true);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setActiveSrc(null);
    setActiveCaption(null);
    document.body.style.overflow = "";
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "+" || e.key === "=") setScale(s => Math.min(MAX_SCALE, s + ZOOM_STEP));
      if (e.key === "-" || e.key === "_") setScale(s => Math.max(MIN_SCALE, s - ZOOM_STEP));
      if (e.key.toLowerCase() === "r") {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)));
  };

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    draggingRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onMouseUpOrLeave = () => { draggingRef.current = false; };

  const zoomIn  = () => setScale(s => Math.min(MAX_SCALE, s + ZOOM_STEP));
  const zoomOut = () => setScale(s => Math.max(MIN_SCALE, s - ZOOM_STEP));
  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className="search-container">
      <h2>Similar Images</h2>

      <div className="uploader-row">
        <input
          id={fileid}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="file-input-hidden"
        />
        <label htmlFor={fileid} className="file-button">Choose Image</label>
        <span className="file-name">{file ? file.name : "No file chosen"}</span>

        <label className="k-input">
          K (max results):
          <input
            type="number"
            min={1}
            max={1000}
            value={k}
            onChange={(e) => setK(e.target.valueAsNumber)}
          />
        </label>

        <button onClick={handleSearch} disabled={loading || !file} className="primary-btn">
          {loading ? "Searching..." : "Find Exact"}
        </button>

        <button onClick={handleClear} className="secondary-btn" disabled={loading}>
          Clear
        </button>
      </div>

      {file && (
        <div className="preview-box">
          <p className="section-title">Query Image</p>
          <img className="preview-img" src={previewUrl ?? ""} alt="query" />
        </div>
      )}

      {notification && <Notification message={notification.message} type={notification.type} />}
      {loading && <Loader />}
      {error && <p className="search-error">{error}</p>}

      {exactMatches.length > 0 ? (
        <>
          <div className="pagination-controls">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Prev</button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>Next</button>
          </div>

          <div className="result-grid">
            {paginatedResults.map((item, idx) => (
              <article className="result-card" key={idx}>
                <div className="result-thumb">
                  <img
                    src={item.imageSrc}
                    alt="Uploaded"
                    loading="lazy"
                    onClick={() => openLightbox(item.imageSrc, cleanName(item.filename))}
                    title="Click to zoom"
                    style={{ cursor: "zoom-in" }}
                  />
                </div>
                <div className="result-name" title={item.filename}>
                  {cleanName(item.filename)}
                </div>
                <div className="result-audio">
                  {item.audioSrc && <audio controls src={item.audioSrc} preload="metadata" />}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        !loading && (
          <p className="empty-hint">
            {file ? "No matches found for this image." : "Pick an image and search."}
          </p>
        )
      )}

      {/* ---------- Lightbox Overlay ---------- */}
      {lightboxOpen && activeSrc && (
        <div
          className="lb-backdrop"
          onClick={(e) => {
            if ((e.target as HTMLElement).classList.contains("lb-backdrop")) {
              closeLightbox();
            }
          }}
        >
          <div
            className="lb-stage"
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUpOrLeave}
            onMouseLeave={onMouseUpOrLeave}
          >
            <img
              src={activeSrc}
              alt={activeCaption ?? "preview"}
              className="lb-img"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
              draggable={false}
            />

            {activeCaption && <div className="lb-caption">{activeCaption}</div>}

            <div className="lb-controls">
              <button onClick={zoomOut} aria-label="Zoom out">−</button>
              <button onClick={resetView} aria-label="Reset zoom">Reset</button>
              <button onClick={zoomIn} aria-label="Zoom in">+</button>
              <button className="lb-close" onClick={closeLightbox} aria-label="Close">✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
