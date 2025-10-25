import { useCallback, useEffect, useState, useRef } from "react";
import { BASE_URL } from "../constants";
import { fetchContent, type MediaItem } from "../services/content_api";
import "../styles/ContentGrid.css";

export default function ContentGrid() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(4);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"all" | "similar">("all");

  // --- Lightbox/Zoom state ---
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

  const getErrorMessage = useCallback((e: unknown): string => {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (typeof e === "object" && e !== null && "message" in e) {
      const maybeMsg = (e as { message?: unknown }).message;
      if (typeof maybeMsg === "string") return maybeMsg;
    }
    return "Failed to load";
  }, []);

  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");
    return () => {
      wrapper?.classList.remove("upload-bg");
    };
  }, []);

  useEffect(() => {
    if (mode !== "all") return;
    let ignore = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchContent(page, limit);
        if (!ignore) {
          setItems(data.items);
          setTotal(data.total);
        }
      } catch (err: unknown) {
        if (!ignore) setErr(getErrorMessage(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [page, limit, mode, getErrorMessage]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const showAll = () => {
    setMode("all");
    setPage(1);
  };

  function pickDisplayName(item: MediaItem) {
    if (item.basename) return item.basename;
    if (item.imageFilename) return item.imageFilename.replace(/\.[^.]+$/, "");
    const last = (item.imageUrl || "").split("/").pop() || "";
    return last.replace(/\.[^.]+$/, "");
  }

  const cleanName = (filename: string) => {
    if (!filename) return "";
    return filename.split("_")[0].split(".")[0];
  };

  // -------- Lightbox handlers --------
  const openLightbox = (src: string, caption?: string) => {
    setActiveSrc(src);
    setActiveCaption(caption ?? null);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setLightboxOpen(true);
    // Disable background scroll
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
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP));
      if (e.key === "-" || e.key === "_") setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP));
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
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)));
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
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onMouseUpOrLeave = () => {
    draggingRef.current = false;
  };

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP));
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="grid-page">
      <div className="upload-wrapper">
        <div className="upload-inner" style={{ display: "flex", gap: 8 }}>
          {mode === "similar" && (
            <button className="btn" onClick={showAll} disabled={loading}>
              ← Back to All
            </button>
          )}
        </div>
      </div>

      <div className="grid-title">
        {mode === "all" ? "All Uploads" : "Similar Results"}
      </div>

      {mode === "all" && (
        <div className="grid-controls">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {err && <div className="grid-error">⚠️ {err}</div>}

      <div className="media-grid">
        {items.map((item) => {
          const src = item.imageUrl?.startsWith("http")
            ? item.imageUrl!
            : `${BASE_URL}${item.imageUrl}`;
          const caption = cleanName(pickDisplayName(item));
          return (
            <article className="media-card" key={item._id ?? item.imageUrl}>
              <figure className="media-thumb">
                <img
                  src={src}
                  alt="Uploaded"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                  }}
                  onClick={() => openLightbox(src, caption)}
                  title="Click to zoom"
                  style={{ cursor: "zoom-in" }}
                />
                <figcaption className="media-name" title={caption}>
                  {caption}
                </figcaption>
              </figure>

              <div className="media-audio">
                {item.audioUrl && (
                  <audio
                    controls
                    src={
                      item.audioUrl?.startsWith("http")
                        ? item.audioUrl
                        : `${BASE_URL}${item.audioUrl}`
                    }
                    preload="metadata"
                  />
                )}
              </div>

              <div className="media-meta">
                {item.createdAt && (
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                )}
              </div>
            </article>
          );
        })}

        {!loading && items.length === 0 && (
          <div className="empty-state">No items.</div>
        )}
      </div>

      {loading && <div className="grid-loading">Loading…</div>}

      {/* ---------- Lightbox Overlay ---------- */}
      {lightboxOpen && activeSrc && (
        <div
          className="lb-backdrop"
          onClick={(e) => {
            // click on backdrop (not on image area) closes
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
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              }}
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
