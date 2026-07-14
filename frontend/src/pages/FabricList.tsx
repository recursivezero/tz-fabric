import { useEffect, useMemo, useRef, useState } from "react";
import { FiZoomIn } from "react-icons/fi";

import { BASE_URL } from "../constants";
import { fetchContent, type MediaItem } from "../services/content_api";
import "@/assets/styles/ContentGrid.css";
import { formatUploadedAt } from "../utils/dateTime";
import { throttle } from "../utils/throttle";

const USER_FRIENDLY_SERVER_ERROR =
  "Unable to connect to the server, please try after some time.";

export default function ContentGrid() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(4);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"all" | "similar">("all");

  // ✅ Track broken images
  const [badImages, setBadImages] = useState<Set<string>>(new Set());
  const markBad = (src: string) => {
    setBadImages((prev) => new Set([...prev, src]));
  };

  // ---------- Lightbox / Zoom ----------
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const previousBodyOverflowRef = useRef<string | null>(null);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 6;
  const ZOOM_STEP = 0.2;

  const clampLightboxOffset = (next: { x: number; y: number }) => {
    const viewportWidth =
      typeof window === "undefined" ? 1200 : window.innerWidth;
    const viewportHeight =
      typeof window === "undefined" ? 800 : window.innerHeight;
    const scaleAllowance = Math.max(1, scale);
    const maxX = Math.round(
      Math.min(viewportWidth * 0.42, 460 * scaleAllowance),
    );
    const maxY = Math.round(
      Math.min(viewportHeight * 0.42, 360 * scaleAllowance),
    );

    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  };

  // Add page background
  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");
    return () => {
      wrapper?.classList.remove("upload-bg");
    };
  }, []);

  // Fetch items
  useEffect(() => {
    if (mode !== "all") return;

    const controller = new AbortController();
    let ignore = false;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchContent(page, limit, controller.signal);
        if (!ignore) {
          setItems(data.items);
          setTotal(data.total);
        }
      } catch (error) {
        if (
          !ignore &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setErr(
            error instanceof Error && error.message
              ? error.message
              : USER_FRIENDLY_SERVER_ERROR,
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [page, limit, mode]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const showAll = () => {
    setMode("all");
    setPage(1);
  };

  function pickDisplayName(item: MediaItem) {
    const fromImageFilename = item.imageFilename?.trim();
    const fromUrl = item.imageUrl
      ? decodeURIComponent(
          (item.imageUrl.split(/[?#]/)[0].split("/").pop() || "").trim(),
        )
      : "";
    const fromBasename = item.basename?.trim();

    // Prefer the actual uploaded/stored filename. Basename can be a generated or
    // user-facing title and was creating very long card captions on the List page.
    return fromImageFilename || fromUrl || fromBasename || "Uploaded fabric";
  }

  const cleanName = (filename: string) => {
    const raw = String(filename || "").trim();
    if (!raw) return "Uploaded fabric";

    const withoutQuery = raw.split(/[?#]/)[0];
    const lastSegment = decodeURIComponent(
      withoutQuery.split("/").pop() || withoutQuery,
    );
    const withoutExtension = lastSegment.replace(/\.[^.]+$/, "");

    const normalized = withoutExtension
      .replace(/(?:[_\s-]?20\d{6}T\d{6})(?:[_\s-]?[a-z0-9]{4,})?$/i, "")
      .replace(/(?:[_\s-]?20\d{6})[_\s-]?\d{6}.*$/i, "")
      .replace(/[_\s-][a-f0-9]{5,}$/i, "")
      .replace(/\b\d{10,}\b/g, "")
      .replace(/^[a-f0-9]{6,}\s+/i, "")
      .replace(/^\d+(?:[\s_-]+\d+){1,}\s*/i, "")
      .replace(/[_-](?:copy|final|submitted)$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const letters = (normalized.match(/[a-z]/gi) ?? []).length;
    const digits = (normalized.match(/\d/g) ?? []).length;
    const looksTechnical =
      !letters ||
      digits > letters ||
      /\b(?:single image|image|img|upload|submitted files?)\b/i.test(
        normalized,
      ) ||
      /^[a-f0-9]{6,}\b/i.test(normalized);

    if (looksTechnical) return "Fabric sample";

    const shortName = normalized.split(" ").slice(0, 3).join(" ");
    return (
      shortName.replace(/\b\w/g, (char) => char.toUpperCase()) ||
      "Uploaded fabric"
    );
  };

  // ✅ Hide items with missing/broken images
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const src = item.imageUrl?.startsWith("http")
        ? item.imageUrl
        : `${BASE_URL}${item.imageUrl}`;

      return !badImages.has(src);
    });
  }, [items, badImages]);

  // ---------- Lightbox handlers ----------
  const openLightbox = (src: string, caption?: string) => {
    setActiveSrc(src);
    setActiveCaption(caption ?? null);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setLightboxOpen(true);
    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setActiveSrc(null);
    setActiveCaption(null);
    document.body.style.overflow = previousBodyOverflowRef.current ?? "";
    previousBodyOverflowRef.current = null;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-render loop.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "+" || e.key === "=")
        setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP));
      if (e.key === "-" || e.key === "_")
        setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP));
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
    if ((e.target as HTMLElement).closest(".lb-controls")) return;
    draggingRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => clampLightboxOffset({ x: o.x + dx, y: o.y + dy }));
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

  const safePrev = useMemo(
    () => throttle(() => setPage((p) => Math.max(1, p - 1)), 1000),
    [],
  );

  const safeNext = useMemo(
    () => throttle(() => setPage((p) => Math.min(totalPages, p + 1)), 1000),
    [totalPages],
  );

  return (
    <div className="grid-page">
      <h1 className="grid-page-title">Fabric List</h1>
      <h3 className="grid-page-subtitle">
        List of uploaded fabric with their audio description
      </h3>
      <div className="upload-wrapper">
        <div className="upload-inner" style={{ display: "flex", gap: 8 }}>
          {mode === "similar" && (
            <button className="btn" onClick={showAll} disabled={loading}>
              ← Back to All
            </button>
          )}
        </div>
      </div>

      <div className="grid-header">
        <div className="grid-left">
          <span className="grid-title-text">
            {mode === "all" ? "Total Fabrics" : "Similar Results"}
          </span>
          <span className="grid-count-inline">({total})</span>
        </div>

        {mode === "all" && visibleItems.length > 0 && (
          <div className="grid-controls inline">
            <button disabled={page === 1} onClick={safePrev}>
              ← Prev
            </button>
            <span className="grid-page-indicator">
              Page {page} / {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={safeNext}>
              Next →
            </button>
          </div>
        )}
      </div>

      {err && <div className="grid-error">⚠️ {err}</div>}
      {!loading && visibleItems.length === 0 && !err && (
        <div className="empty-state">No image found.</div>
      )}

      <div className="media-grid">
        {visibleItems.map((item) => {
          const rawSrc = item.imageUrl;
          const src = rawSrc?.startsWith("http")
            ? rawSrc
            : `${BASE_URL}${rawSrc}`;
          const rawDisplayName = pickDisplayName(item);
          const caption = cleanName(rawDisplayName);

          return (
            <article className="media-card" key={item._id ?? src}>
              <figure className="media-thumb">
                <div className="img-wrapper">
                  <img
                    src={src}
                    alt={caption}
                    loading="lazy"
                    decoding="async"
                    onError={() => markBad(src)}
                    onClick={() => openLightbox(src, caption)}
                  />
                  <span
                    className="zoom-icon"
                    onClick={() => openLightbox(src, caption)}
                    title="Zoom image"
                    role="button"
                    aria-label="Zoom image"
                  >
                    <FiZoomIn size={25} />
                  </span>
                </div>

                <figcaption
                  className="media-name"
                  title={rawDisplayName}
                  onClick={() => openLightbox(src, caption)}
                >
                  {caption}
                </figcaption>
              </figure>
              <div className="media-audio">
                <div className="audio-box">
                  <span className="audio-label">Fabric description</span>

                  {item.audioUrl && (
                    <audio
                      controls
                      src={
                        item.audioUrl.startsWith("http")
                          ? item.audioUrl
                          : `${BASE_URL}${item.audioUrl}`
                      }
                      preload="metadata"
                      controlsList="nodownload"
                    />
                  )}
                </div>
              </div>

              <div className="media-meta">
                {(() => {
                  const uploadedAt = formatUploadedAt(item.createdAt);
                  return uploadedAt ? (
                    <time dateTime={item.createdAt ?? undefined}>
                      Uploaded {uploadedAt}
                    </time>
                  ) : (
                    <span>Upload time unavailable</span>
                  );
                })()}
              </div>
            </article>
          );
        })}
      </div>

      {loading && <div className="grid-loading">Loading…</div>}

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
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              }}
              draggable={false}
            />

            {activeCaption && <div className="lb-caption">{activeCaption}</div>}

            <div className="lb-controls">
              <button
                type="button"
                onClick={zoomOut}
                aria-label="Zoom out"
                title="Zoom out"
                disabled={scale <= MIN_SCALE}
              >
                −
              </button>
              <button type="button" onClick={resetView} title="Reset zoom">
                Reset
              </button>
              <button
                type="button"
                onClick={zoomIn}
                aria-label="Zoom in"
                title="Zoom in"
                disabled={scale >= MAX_SCALE}
              >
                +
              </button>
              <button
                type="button"
                className="lb-close"
                onClick={closeLightbox}
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
