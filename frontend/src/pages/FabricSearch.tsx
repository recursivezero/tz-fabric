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

  // track images that fail to load (missing locally)
  const [badImages, setBadImages] = useState<Set<string>>(new Set());
  const markBadImage = (src?: string) => {
    if (!src) return;
    setBadImages(prev => new Set([...prev, src]));
  };

  // keep original selected file for re-cropping
  const originalFileRef = useRef<File | null>(null);

  // --- New: drawer + cropping UI state ---
  const [drawerOpen, setDrawerOpen] = useState(false);
  // cropping rectangle in displayed image coordinates
  const [cropRect, setCropRect] = useState({ x: 20, y: 20, w: 160, h: 160 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null); // original selected (before cropping)

  // dragging state for moving crop rect
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // --- existing file handling (modified to open drawer on selection) ---
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    // preserve original file for re-cropping
    originalFileRef.current = f;
    // set a temporary object URL for cropping preview
    const url = URL.createObjectURL(f);
    setRawImageUrl(url);
    setDrawerOpen(true);
    // reset crop rect to default (will be repositioned on image load)
    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
    // clear any previous notifications / bad images
    setNotification(null);
    setBadImages(new Set());
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
    try {
      await runSearch(file);
      setPage(1);
    } catch (err) {
      setNotification({ message: "Search failed.", type: "error" });
    }
  };

  const handleClear = () => {
    setFile(null);
    clear();
    setPage(1);
    setNotification(null);
    setBadImages(new Set());
    // revoke raw image
    if (rawImageUrl) {
      try { URL.revokeObjectURL(rawImageUrl); } catch { }
      setRawImageUrl(null);
    }
    // revoke preview object URL handled by effect
    originalFileRef.current = null;
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
  useEffect(() => {
    return () => {
      if (previewUrl) {
        try { URL.revokeObjectURL(previewUrl); } catch { }
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");
    return () => wrapper?.classList.remove("upload-bg");
  }, []);

  // Lightbox & pan/zoom (unchanged)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingLightboxRef = useRef(false);
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
    draggingLightboxRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!draggingLightboxRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onMouseUpOrLeave = () => { draggingLightboxRef.current = false; };

  const safePrev = useMemo(
    () => throttle(() => setPage((p) => Math.max(1, p - 1)), 1000),
    []
  );

  const safeNext = useMemo(
    () => throttle(() => setPage((p) => Math.min(totalPages, p + 1)), 1000),
    [totalPages]
  );

  // Show hero when there is no active file and no results currently visible.
  const showHero = !file && visibleResults.length === 0 && !loading;

  // --- CROP interactions (basic: move and bottom-right resize) ---
  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      if ((!draggingRef.current && !resizingRef.current)) return;
      ev.preventDefault();
      const dx = ev.clientX - lastMouseRef.current.x;
      const dy = ev.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: ev.clientX, y: ev.clientY };

      setCropRect(prev => {
        if (draggingRef.current) {
          // move entire rect
          return {
            x: Math.max(0, prev.x + dx),
            y: Math.max(0, prev.y + dy),
            w: prev.w,
            h: prev.h
          };
        } else if (resizingRef.current) {
          // resize from bottom-right
          return {
            x: prev.x,
            y: prev.y,
            w: Math.max(40, prev.w + dx),
            h: Math.max(40, prev.h + dy)
          };
        }
        return prev;
      });
    };

    const onUp = () => {
      draggingRef.current = false;
      resizingRef.current = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // When image loads, ensure crop rect fits inside and scale reasonably
  const onCropImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const dispW = img.clientWidth;
    const dispH = img.clientHeight;
    // Set default crop to centered square taking 40% of shortest side
    const short = Math.min(dispW, dispH);
    const size = Math.round(short * 0.48);
    const x = Math.round((dispW - size) / 2);
    const y = Math.round((dispH - size) / 2);
    setCropRect({ x, y, w: size, h: size });
  };

  // Create cropped File, set as query preview (file) but DO NOT run search automatically.
  const makeCroppedPreview = async (): Promise<void> => {
    if (!rawImageUrl || !imgRef.current) return;
    const imgEl = imgRef.current;
    const dispW = imgEl.clientWidth;
    const dispH = imgEl.clientHeight;
    const natW = imgEl.naturalWidth;
    const natH = imgEl.naturalHeight;

    const rx = cropRect.x / dispW;
    const ry = cropRect.y / dispH;
    const rw = cropRect.w / dispW;
    const rh = cropRect.h / dispH;

    const sx = Math.round(rx * natW);
    const sy = Math.round(ry * natH);
    const sw = Math.max(1, Math.round(rw * natW));
    const sh = Math.max(1, Math.round(rh * natH));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setNotification({ message: "Could not crop image.", type: "error" });
      return;
    }

    const imgObj = new Image();
    imgObj.crossOrigin = "anonymous";
    imgObj.src = rawImageUrl;
    try {
      await new Promise((res, rej) => {
        imgObj.onload = () => res(true);
        imgObj.onerror = () => rej(new Error("load error"));
      });
    } catch {
      setNotification({ message: "Could not load image for cropping.", type: "error" });
      return;
    }

    ctx.drawImage(imgObj, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setNotification({ message: "Could not generate image blob.", type: "error" });
      return;
    }
    const croppedFile = new File([blob], `query-cropped-${Date.now()}.jpg`, { type: "image/jpeg" });

    // revoke previous rawImageUrl but keep originalFileRef for re-cropping
    if (rawImageUrl) {
      try { URL.revokeObjectURL(rawImageUrl); } catch { }
      setRawImageUrl(null);
    }

    // Set the cropped file as the query file (preview updates). DO NOT auto-run search.
    setFile(croppedFile);
    setDrawerOpen(false);
    setNotification({ message: "Preview ready — click Search when you're ready.", type: "success" });
    // reset page and badImages (optional)
    setPage(1);
    setBadImages(new Set());
  };

  const cancelCropAndClose = () => {
    // close drawer, revoke raw url and keep user on search page (no new file)
    if (rawImageUrl) {
      try { URL.revokeObjectURL(rawImageUrl); } catch { }
      setRawImageUrl(null);
    }
    setDrawerOpen(false);
    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
  };

  // ensure cropRect never leaves image area
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const dispW = img.clientWidth;
    const dispH = img.clientHeight;
    setCropRect(prev => {
      const x = Math.min(Math.max(0, prev.x), Math.max(0, dispW - 20));
      const y = Math.min(Math.max(0, prev.y), Math.max(0, dispH - 20));
      const w = Math.min(Math.max(40, prev.w), dispW - x);
      const h = Math.min(Math.max(40, prev.h), dispH - y);
      return { x, y, w, h };
    });
  }, [rawImageUrl, drawerOpen, imgRef.current?.clientWidth, imgRef.current?.clientHeight]);

  // cleanup rawImageUrl on unmount
  useEffect(() => () => { if (rawImageUrl) { try { URL.revokeObjectURL(rawImageUrl); } catch { } } }, [rawImageUrl]);

  return (
    <div className="search-container">

      <FabricSearchHeader />

      { /* HERO */}
      {!file && visibleResults.length === 0 && !loading && !drawerOpen && (
        <header className="hero-area">
          <h1 className="hero-title">
            Here you find all the clothing<br />items you couldn't find.
            <span className="hero-highlight" aria-hidden />
          </h1>

          <div className="hero-cta">
            <input
              id={fileid}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="file-input-hidden"
            />

            <button
              className="hero-search-btn"
              onClick={() => document.getElementById(fileid)?.click()}
              aria-label="Upload image to search"
            >
              📷 Image Search
            </button>
          </div>
        </header>
      )}

      {file && !drawerOpen && (
        <div className="preview-box center-preview">
          <p className="section-title">Your Image</p>
          <img className="preview-img" src={previewUrl ?? ""} alt="query" />
        </div>
      )}
      {file && !drawerOpen && (
        <div className="preview-actions">
          <button
            className="btn primary"
            onClick={handleSearch}
            disabled={loading || !file}
          >
            🔎 Search
          </button>

          <button
            className="btn"
            onClick={() => {
              const orig = originalFileRef.current;
              if (!orig) {
                setNotification({ message: "Original image not available to re-crop.", type: "error" });
                return;
              }
              const url = URL.createObjectURL(orig);
              setRawImageUrl(url);
              setDrawerOpen(true);
              setNotification(null);
              setCropRect({ x: 20, y: 20, w: 160, h: 160 });
            }}
          >
            ✂️ Re-crop
          </button>

          <button
            className="btn secondary"
            onClick={() => {
              handleClear();
              originalFileRef.current = null;
            }}
          >
            🗑 Clear
          </button>
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
      {drawerOpen && rawImageUrl && (
        <div className={`crop-drawer open`} role="dialog" aria-hidden={!drawerOpen}>
          <div className="crop-drawer-inner">
            <h3 className="drawer-title">Crop & Confirm</h3>

            <div className="crop-stage">
              {rawImageUrl ? (
                <div className="crop-image-wrap">
                  <img
                    ref={imgRef}
                    src={rawImageUrl}
                    alt="to-crop"
                    onLoad={onCropImageLoad}
                    className="crop-image"
                    draggable={false}
                  />

                  <div
                    className="crop-rect"
                    style={{
                      left: `${cropRect.x}px`,
                      top: `${cropRect.y}px`,
                      width: `${cropRect.w}px`,
                      height: `${cropRect.h}px`
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      draggingRef.current = true;
                      lastMouseRef.current = { x: e.clientX, y: e.clientY };
                    }}
                  >
                    <div className="crop-handle br"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        resizingRef.current = true;
                        lastMouseRef.current = { x: e.clientX, y: e.clientY };
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="crop-placeholder">No image selected</div>
              )}
            </div>

            <div className="drawer-actions">
              <button className="drawer-btn cancel" onClick={cancelCropAndClose}>✕ Cancel</button>
              <button className="drawer-btn confirm" onClick={makeCroppedPreview}>✔ Preview Crop</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
