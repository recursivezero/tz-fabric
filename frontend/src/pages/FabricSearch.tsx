import { useId, useMemo, useState, useEffect, useRef, useCallback } from "react";
import Loader from "../components/Loader";
import Notification from "../components/Notification";
import useImageSearch from "../hooks/useImageSearch";
import FabricSearchHeader from "../components/FabricSearchHeader";
import "../styles/FabricSearch.css";
import { throttle } from "../utils/throttle";

export default function Search() {
  const { loading, error, exactMatches, runSearch, clear } = useImageSearch();
  const [file, setFile] = useState<File | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const pageSize = 4;
  const [page, setPage] = useState(1);

  // ✅ NEW — track images that fail to load (missing locally)
  const [badImages, setBadImages] = useState<Set<string>>(new Set());
  const markBadImage = (src?: string) => {
    if (!src) return;
    setBadImages(prev => new Set([...prev, src]));
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPage(1);
  };

  const dataUrlToFile = useCallback(async (dataUrl: string, filename = "query.png"): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  }, []);

  const urlToFile = useCallback(async (url: string, filename = "query.jpg"): Promise<File> => {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`Failed to fetch image_url: ${res.status}`);
    const blob = await res.blob();
    const ext = (blob.type && blob.type.split("/")[1]) || "jpg";
    const name = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  }, []);

  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;

    const params = new URLSearchParams(window.location.search);
    const urlImage = params.get("image_url");

    if (urlImage) {
      didAutoRun.current = true;
      (async () => {
        try {
          const f = await urlToFile(urlImage, `query-${Date.now()}`);
          setFile(f);
          await runSearch(f);
        } catch {
          setNotification({ message: "Could not auto-run search from URL.", type: "error" });
        } finally {
          try { localStorage.removeItem("mcp_last_search"); } catch { }
          setPage(1);
        }
      })();
      return;
    }

    try {
      const raw = localStorage.getItem("mcp_last_search");
      if (!raw) return;

      didAutoRun.current = true;

      (async () => {
        try {
          const parsed = JSON.parse(raw);
          let f: File | null = null;

          if (parsed?.imageUrl) {
            f = await urlToFile(parsed.imageUrl, `query-${Date.now()}`);
          } else if (parsed?.queryPreview) {
            f = await dataUrlToFile(parsed.queryPreview, `query-${Date.now()}.png`);
          }

          if (!f) throw new Error("No usable image in payload.");

          setFile(f);
          await runSearch(f);
        } catch {
          setNotification({ message: "Could not auto-run search payload.", type: "error" });
        } finally {
          try { localStorage.removeItem("mcp_last_search"); } catch { }
          setPage(1);
        }
      })();
    } catch { }
  }, [runSearch, dataUrlToFile, urlToFile]);

  const cleanName = (filename: string) =>
    filename ? filename.split("_")[0].split(".")[0] : "";

  const handleSearch = async () => {
    if (!file) return;
    setNotification(null);
    await runSearch(file);
    setPage(1);
  };

  const handleClear = () => {
    setFile(null);
    clear();
    setPage(1);
    setNotification(null);
    setBadImages(new Set()); // ✅ also reset hidden images
  };

  const visibleResults = useMemo(
    () => exactMatches.filter(item => !badImages.has(item.imageSrc)),
    [exactMatches, badImages]
  );

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleResults.slice(start, start + pageSize);
  }, [page, visibleResults]);

  const totalPages = Math.max(1, Math.ceil(visibleResults.length / pageSize));
  const fileid = useId();
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");
    return () => wrapper?.classList.remove("upload-bg");
  }, []);

  // ✅ Lightbox — unchanged
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const MIN_SCALE = 0.5, MAX_SCALE = 6, ZOOM_STEP = 0.2;

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

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP))));
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

  const safePrev = useMemo(
    () => throttle(() => setPage((p) => Math.max(1, p - 1)), 1000),
    []
  );

  const safeNext = useMemo(
    () => throttle(() => setPage((p) => Math.min(totalPages, p + 1)), 1000),
    [totalPages]
  );

  return (
    <div className="search-container">

      <FabricSearchHeader />

      <div className="mega-area">
        <div className="mega-label">Upload a fabric image and search similar images</div>

        <div className="mega-bar-row">
          <div className="mega-search">
            <input
              id={fileid}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="file-input-hidden"
            />

            <button
              type="button"
              className="mega-icon-btn mega-left"
              onClick={() => document.getElementById(fileid)?.click()}
            >
              📁
            </button>

            <div className="mega-content">
              {file ? (
                <div className="mega-k-row">
                  <span className="query-name" title={file.name}>
                    {cleanName(file.name)}
                  </span>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="mega-icon-btn mega-right"
              disabled={!file}
              onClick={handleSearch}
            >
              🔍
            </button>
            <button onClick={handleClear} className="secondary-btn clear-inline">Clear</button>
          </div>
        </div>
      </div>

      {file && (
        <div className="preview-box">
          <p className="section-title">Your Image</p>
          <img className="preview-img" src={previewUrl ?? ""} alt="query" />
        </div>
      )}

      {notification && <Notification message={notification.message} type={notification.type} />}
      {loading && <Loader />}
      {error && <p className="search-error">{error}</p>}

      {visibleResults.length > 0 ? (
        <>
          <div className="pagination-controls">
            <button onClick={safePrev} disabled={page === 1}>Prev</button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={safeNext} disabled={page === totalPages}>Next</button>
          </div>

          <div className="result-grid">
            {paginatedResults.map((item, idx) => (
              <article className="result-card" key={idx}>
                <div className="result-thumb">
                  <img
                    src={item.imageSrc}
                    alt={item.filename}
                    loading="lazy"
                    onError={() => markBadImage(item.imageSrc)}
                    onClick={() => openLightbox(item.imageSrc, cleanName(item.filename))}
                    style={{ cursor: "zoom-in" }}
                  />

                  <button
                    type="button"
                    className="zoom-btn"
                    aria-label="Zoom image"
                    title="Zoom"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLightbox(item.imageSrc, cleanName(item.filename));
                    }}
                  >
                    🔍
                  </button>
                </div>

                <div
                  className="result-name"
                  onClick={() => openLightbox(item.imageSrc, cleanName(item.filename))}
                >
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
        !loading && file && <p className="empty-hint">No matches found.</p>
      )}

      {lightboxOpen && activeSrc && (
        <div
          className="lb-backdrop"
          onClick={(e) => { if ((e.target as HTMLElement).classList.contains("lb-backdrop")) closeLightbox(); }}
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
              <button onClick={() => setScale(s => Math.max(MIN_SCALE, s - ZOOM_STEP))}>−</button>
              <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>Reset</button>
              <button onClick={() => setScale(s => Math.min(MAX_SCALE, s + ZOOM_STEP))}>+</button>
              <button className="lb-close" onClick={closeLightbox}>✕</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
