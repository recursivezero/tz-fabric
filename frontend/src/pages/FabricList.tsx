import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiZoomIn } from "react-icons/fi";

import { BASE_URL } from "../constants";
import { fetchContent, type MediaItem } from "../services/content_api";
import "@/assets/styles/ContentGrid.css";
import { throttle } from "../utils/throttle";

const displayTime = (t: string) => {
  return new Date(t).toLocaleString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

export default function ContentGrid() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(4);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"all" | "similar">("all");
  const [listQuery, setListQuery] = useState("");

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

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 6;
  const ZOOM_STEP = 0.2;

  const getErrorMessage = useCallback((e: unknown): string => {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (typeof e === "object" && e !== null && "message" in e) {
      const maybeMsg = e.message;
      if (typeof maybeMsg === "string") return maybeMsg;
    }
    return "Failed to load";
  }, []);

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
      } catch (err) {
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
    if (item.imageFilename)
      return item.imageFilename.replace(/\.[^.]+$/, "");
    const last = (item.imageUrl || "").split("/").pop() || "";
    return last.replace(/\.[^.]+$/, "");
  }

  const cleanName = (filename: string) =>
    filename?.split("_")[0].split(".")[0] ?? "";

  // ✅ Hide items with missing/broken images + filter list by text search
  const visibleItems = useMemo(() => {
    const query = listQuery.trim().toLowerCase();

    return items.filter((item) => {
      const src = item.imageUrl?.startsWith("http")
        ? item.imageUrl
        : `${BASE_URL}${item.imageUrl}`;

      if (badImages.has(src)) return false;
      if (!query) return true;

      const searchable = [
        pickDisplayName(item),
        item.basename,
        item.imageFilename,
        item.imageUrl,
        item.audioUrl,
        item.audioFilename,
        item.createdAt,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [items, badImages, listQuery]);

  // ---------- Lightbox handlers ----------
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const safePrev = useMemo(
    () => throttle(() => setPage((p) => Math.max(1, p - 1)), 1000),
    []
  );

  const safeNext = useMemo(
    () => throttle(() => setPage((p) => Math.min(totalPages, p + 1)), 1000),
    [totalPages]
  );

  return (
    <div className="grid-page">
      <div className="grid-page-hero">
        <p className="grid-page-eyebrow">Fabric Library</p>
        <h1 className="grid-page-title">Fabric List</h1>
        <p className="grid-page-subtitle">List of uploaded fabric with their audio description</p>
      </div>

      <div className="grid-search-panel" role="search" aria-label="Search uploaded fabrics">
        <div className="grid-search-panel__field">
          <span className="grid-search-panel__icon" aria-hidden>⌕</span>
          <input
            type="search"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder="Search by name, tags, description, or filename…"
            aria-label="Search uploaded fabrics"
          />
          {listQuery && (
            <button
              className="grid-search-panel__clear"
              type="button"
              onClick={() => setListQuery("")}
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="upload-wrapper">
        <div className="upload-inner" style={ { display: "flex", gap: 8 } }>
          { mode === "similar" && (
            <button className="btn" onClick={ showAll } disabled={ loading }>
              ← Back to All
            </button>
          ) }
        </div>
      </div>

      <div className="grid-header">
        <div className="grid-left">
          <span className="grid-title-text">
            { mode === "all" ? "Total Fabrics" : "Similar Results" }
          </span>
          <span className="grid-count-inline">({ total })</span>
        </div>

        { mode === "all" && visibleItems.length > 0 && (
          <div className="grid-controls inline">
            <button disabled={ page === 1 } onClick={ safePrev }>
              ← Prev
            </button>
            <span className="grid-page">
              Page { page } / { totalPages }
            </span>
            <button
              disabled={ page >= totalPages }
              onClick={ safeNext }
            >
              Next →
            </button>
          </div>
        ) }
      </div>

      { err && <div className="grid-error">⚠️ { err }</div> }
      { !loading && visibleItems.length === 0 && !err && (
        <div className="empty-state">
          {listQuery ? `No fabric found for "${listQuery}".` : "No image found."}
        </div>
      ) }

      <div className="media-grid">
        { visibleItems.map((item) => {
          const rawSrc = item.imageUrl;
          const src =
            rawSrc?.startsWith("http") ? rawSrc : `${BASE_URL}${rawSrc}`;
          const caption = cleanName(pickDisplayName(item));

          return (
            <article className="media-card" key={ item._id ?? src }>
              <figure className="media-thumb">
                <div className="img-wrapper">
                  <img
                    src={ src }
                    alt={ caption }
                    loading="lazy"
                    onError={ () => markBad(src) }
                    onClick={ () => openLightbox(src, caption) }
                  />
                  <span
                    className="zoom-icon"
                    onClick={ () => openLightbox(src, caption) }
                    title="Zoom image"
                    role="button"
                    aria-label="Zoom image"
                  >
                    <FiZoomIn size={ 25 } />
                  </span>
                </div>

                <figcaption
                  className="media-name"
                  title={ caption }
                  onClick={ () => openLightbox(src, caption) }
                >
                  { caption }
                </figcaption>
              </figure>
              <div className="media-audio">
                <div className="audio-box">
                  <span className="audio-label">Fabric description</span>

                  { item.audioUrl && (
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
                  ) }
                </div>
              </div>

              <div className="media-meta">
                { item.createdAt && (
                  <time dateTime={ item.createdAt }>
                    { displayTime(item.createdAt) }
                  </time>
                ) }
              </div>
            </article>
          );
        }) }
      </div>

      { loading && <div className="grid-loading">Loading…</div> }

      { lightboxOpen && activeSrc && (
        <div
          className="lb-backdrop"
          onClick={ (e) => {
            if ((e.target as HTMLElement).classList.contains("lb-backdrop")) {
              closeLightbox();
            }
          } }
        >
          <div
            className="lb-stage"
            onWheel={ onWheel }
            onMouseDown={ onMouseDown }
            onMouseMove={ onMouseMove }
            onMouseUp={ onMouseUpOrLeave }
            onMouseLeave={ onMouseUpOrLeave }
          >
            <img
              src={ activeSrc }
              alt={ activeCaption ?? "preview" }
              className="lb-img"
              style={ {
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              } }
              draggable={ false }
            />

            { activeCaption && (
              <div className="lb-caption">{ activeCaption }</div>
            ) }

            <div className="lb-controls">
              <button onClick={ zoomOut }>−</button>
              <button onClick={ resetView }>Reset</button>
              <button onClick={ zoomIn }>+</button>
              <button className="lb-close" onClick={ closeLightbox }>
                ✕
              </button>
            </div>
          </div>
        </div>
      ) }
    </div>
  );
}
