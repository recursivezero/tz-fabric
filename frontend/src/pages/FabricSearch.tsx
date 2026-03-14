import { useId, useMemo, useState, useEffect, useRef, useCallback } from "react";
import Loader from "../components/Loader";
import Notification from "../components/Notification";
import FabricSearchHeader from "../components/FabricSearchHeader";
import "@/assets/styles/FabricSearch.css";
import { throttle } from "../utils/throttle";

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationState = { message: string; type: "success" | "error" } | null;
type DbOp = "create" | "update" | null;

interface ResultItem {
  imageSrc: string;   // raw path/filename from API — toCdnUrl() applied on render
  filename: string;
  audioSrc?: string;
}

interface Pagination {
  page: number;
  per_page: number;
  total_results: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface SearchApiResponse {
  message: string;
  results: string[];        // array of filenames / relative paths
  pagination: Pagination;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const API_BASE =
  (import.meta.env.VITE_API_URL ?? "") +
  (import.meta.env.VITE_API_PREFIX ?? "");

// ─── CDN helper ───────────────────────────────────────────────────────────────

const CDN_BASE = "https://cdn.threadzip.com/uploaded/";

/**
 * Converts a raw filename / relative path returned by the search API
 * into a full CDN URL.
 *   "abc_123.jpg"          → "https://cdn.threadzip.com/uploaded/abc_123.jpg"
 *   "fabrics/abc_123.jpg"  → "https://cdn.threadzip.com/uploaded/fabrics/abc_123.jpg"
 *   "https://…"            → unchanged (already absolute)
 */
function toCdnUrl(src: string | undefined): string {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  return `${CDN_BASE}${src.replace(/^\/+/, "")}`;
}

/**
 * Normalise a raw result string from the API into a ResultItem.
 * The API returns plain filename strings e.g. "fabric_001.jpg"
 */
function toResultItem(raw: string): ResultItem {
  const filename = raw.split("/").pop() ?? raw;
  return { imageSrc: raw, filename };
}

// ─── Self-contained search hook ───────────────────────────────────────────────

function useSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);

  const runImageSearch = useCallback(async (file: File, category?: string) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("limit", "40");
      if (category) form.append("category", category);

      const res = await fetch(`${API_BASE}/search`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? `Search failed (${res.status})`);
      }
      const data: SearchApiResponse = await res.json();
      setResults((data.results ?? []).map(toResultItem));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const runTextSearch = useCallback(async (term: string, category?: string) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("search_term", term);
      form.append("limit", "40");
      if (category) form.append("category", category);

      const res = await fetch(`${API_BASE}/search`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? `Search failed (${res.status})`);
      }
      const data: SearchApiResponse = await res.json();
      setResults((data.results ?? []).map(toResultItem));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { loading, error, results, runImageSearch, runTextSearch, clear };
}

async function callDbEndpoint(op: "create" | "update"): Promise<string> {
  const url =
    op === "create"
      ? `${API_BASE}/api/database/create/table`
      : `${API_BASE}/api/database/update/table`;

  const res = await fetch(url, { method: "PUT" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail ?? `Request failed (${res.status})`);
  return data?.message ?? "Done.";
}

// ─── Small sub-component: DB Control Panel ────────────────────────────────────

function DbControlPanel() {
  const [activeOp, setActiveOp] = useState<DbOp>(null);
  const [notification, setNotification] = useState<NotificationState>(null);

  const handleOp = async (op: "create" | "update") => {
    if (activeOp) return;
    setActiveOp(op);
    setNotification(null);
    try {
      const msg = await callDbEndpoint(op);
      setNotification({ message: msg, type: "success" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Operation failed.";
      setNotification({ message: msg, type: "error" });
    } finally {
      setActiveOp(null);
    }
  };

  return (
    <div className="db-control-panel">
      <div className="db-control-header">
        <span className="db-control-label">Database</span>
      </div>

      <div className="db-control-actions">
        <button
          className={`db-btn create ${activeOp === "create" ? "loading" : ""}`}
          onClick={() => handleOp("create")}
          disabled={!!activeOp}
          title="Rebuild the entire vector table from scratch"
        >
          {activeOp === "create" ? (
            <span className="db-btn-spinner" />
          ) : (
            <span className="db-btn-icon">⬡</span>
          )}
          Create Table
        </button>

        <button
          className={`db-btn update ${activeOp === "update" ? "loading" : ""}`}
          onClick={() => handleOp("update")}
          disabled={!!activeOp}
          title="Add new images to an existing table"
        >
          {activeOp === "update" ? (
            <span className="db-btn-spinner" />
          ) : (
            <span className="db-btn-icon">↻</span>
          )}
          Update Table
        </button>
      </div>

      {notification && (
        <div className={`db-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Inline styles scoped to this panel */}
      <style>{`
        .db-control-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px 18px;
          background: #0f1117;
          border: 1.5px solid #2a2d3a;
          border-radius: 14px;
          margin-bottom: 24px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .db-control-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .db-control-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6b7280;
        }
        .db-control-label::before {
          content: '';
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          margin-right: 7px;
          box-shadow: 0 0 6px #22c55e;
          vertical-align: middle;
        }
        .db-control-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .db-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: filter 0.15s, transform 0.12s, box-shadow 0.15s;
          border: none;
          white-space: nowrap;
          letter-spacing: 0.02em;
        }
        .db-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          filter: none !important;
          transform: none !important;
        }
        .db-btn:not(:disabled):hover {
          filter: brightness(1.12);
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(0,0,0,0.4);
        }
        .db-btn:not(:disabled):active {
          transform: translateY(0);
          filter: brightness(0.95);
        }
        .db-btn.create {
          background: #16a34a;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(22,163,74,0.35);
        }
        .db-btn.update {
          background: #1d4ed8;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(29,78,216,0.35);
        }
        .db-btn-icon {
          font-size: 15px;
          line-height: 1;
        }
        .db-btn-spinner {
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: dbspin 0.7s linear infinite;
          display: inline-block;
          flex-shrink: 0;
        }
        @keyframes dbspin {
          to { transform: rotate(360deg); }
        }
        .db-notification {
          font-size: 12.5px;
          padding: 9px 13px;
          border-radius: 8px;
          line-height: 1.45;
          font-weight: 500;
        }
        .db-notification.success {
          background: #052e16;
          color: #4ade80;
          border: 1px solid #166534;
        }
        .db-notification.error {
          background: #1c0a0a;
          color: #f87171;
          border: 1px solid #7f1d1d;
        }
      `}</style>
    </div>
  );
}

// ─── Main Search Page ─────────────────────────────────────────────────────────

export default function Search() {
  const { loading, error, results, runImageSearch, runTextSearch, clear } = useSearch();
  const [file, setFile] = useState<File | null>(null);
  const [textQuery, setTextQuery] = useState("");
  const [previewUrlOriginal, setPreviewUrlOriginal] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState>(null);
  const [selectingImage, setSelectingImage] = useState(false);

  const pageSize = 4;
  const [page, setPage] = useState(1);

  const [badImages, setBadImages] = useState<Set<string>>(new Set());
  const markBadImage = (src?: string) => {
    if (!src) return;
    setBadImages((prev) => new Set([...prev, src]));
  };

  const originalFileRef = useRef<File | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 20, y: 20, w: 160, h: 160 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);

  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const setOriginalObjectUrl = useCallback(
    (f: File | null) => {
      if (previewUrlOriginal) {
        try {
          URL.revokeObjectURL(previewUrlOriginal);
        } catch {}
      }
      if (f) {
        try {
          setPreviewUrlOriginal(URL.createObjectURL(f));
        } catch {
          setPreviewUrlOriginal(null);
        }
      } else {
        setPreviewUrlOriginal(null);
      }
    },
    [previewUrlOriginal]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    setSelectingImage(true);
    originalFileRef.current = f;
    setOriginalObjectUrl(f);
    const url = URL.createObjectURL(f);
    setPreviewUrlOriginal((prev) => prev ?? url);
    setRawImageUrl(url);
    setDrawerOpen(true);
    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
    setNotification(null);
    setBadImages(new Set());
    try {
      window.dispatchEvent(new CustomEvent("fabricai:clear-pending-action"));
    } catch {}
  };

  const dataUrlToFile = useCallback(
    async (dataUrl: string, filename = "query.png"): Promise<File> => {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      return new File([blob], filename, { type: blob.type || "image/png" });
    },
    []
  );

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
          originalFileRef.current = f;
          setOriginalObjectUrl(f);
          setFile(f);
          await runImageSearch(f);
        } catch {
          setNotification({ message: "Could not auto-run search from URL.", type: "error" });
        } finally {
          try { localStorage.removeItem("mcp_last_search"); } catch {}
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
          originalFileRef.current = f;
          setOriginalObjectUrl(f);
          setFile(f);
          await runImageSearch(f);
        } catch {
          setNotification({ message: "Could not auto-run search payload.", type: "error" });
        } finally {
          try { localStorage.removeItem("mcp_last_search"); } catch {}
          setPage(1);
        }
      })();
    } catch {}
  }, [runImageSearch, dataUrlToFile, urlToFile, setOriginalObjectUrl]);

  const cleanName = (filename: string) =>
    filename ? filename.split("_")[0].split(".")[0] : "";

  const handleSearch = async () => {
    if (!file) return;
    setNotification(null);
    try {
      await runImageSearch(file);
      setPage(1);
    } catch (err) {
      setNotification({ message: "Search failed.", type: "error" });
    }
  };

  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);

  const handleClear = () => {
    setFile(null);
    setTextQuery("");
    clear();
    setPage(1);
    setNotification(null);
    setBadImages(new Set());
    if (rawImageUrl) {
      try {
        URL.revokeObjectURL(rawImageUrl);
      } catch {}
      setRawImageUrl(null);
    }
    if (previewUrlOriginal) {
      try {
        URL.revokeObjectURL(previewUrlOriginal);
      } catch {}
      setPreviewUrlOriginal(null);
    }
    try {
      window.dispatchEvent(new CustomEvent("fabricai:clear-pending-action"));
    } catch {}
    originalFileRef.current = null;
    setCroppedPreviewUrl(null);
  };

  const visibleResults = useMemo(
    () =>
      results.filter((item) => {
        const src = item.imageSrc;
        if (!src) return true;
        return !badImages.has(src);
      }),
    [results, badImages]
  );

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleResults.slice(start, start + pageSize);
  }, [page, visibleResults]);

  const totalPages = Math.max(1, Math.ceil(visibleResults.length / pageSize));
  const fileid = useId();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    let cur: string | null = null;
    if (file) {
      try {
        cur = URL.createObjectURL(file);
        setPreviewUrl(cur);
      } catch {
        setPreviewUrl(null);
      }
    } else {
      setPreviewUrl(null);
    }
    return () => {
      if (cur) {
        try {
          URL.revokeObjectURL(cur);
        } catch {}
      }
    };
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrlOriginal) {
        try {
          URL.revokeObjectURL(previewUrlOriginal);
        } catch {}
      }
    };
  }, [previewUrlOriginal]);

  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");
    return () => wrapper?.classList.remove("upload-bg");
  }, []);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingLightboxRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const MIN_SCALE = 0.5,
    MAX_SCALE = 6,
    ZOOM_STEP = 0.2;

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
    setScale((s) =>
      Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)))
    );
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
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onMouseUpOrLeave = () => {
    draggingLightboxRef.current = false;
  };

  const safePrev = useMemo(
    () => throttle(() => setPage((p) => Math.max(1, p - 1)), 1000),
    []
  );
  const safeNext = useMemo(
    () => throttle(() => setPage((p) => Math.min(totalPages, p + 1)), 1000),
    [totalPages]
  );

  // Crop interactions
  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current && !resizingRef.current) return;
      ev.preventDefault();
      const dx = ev.clientX - lastMouseRef.current.x;
      const dy = ev.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: ev.clientX, y: ev.clientY };
      setCropRect((prev) => {
        if (draggingRef.current) {
          return { x: Math.max(0, prev.x + dx), y: Math.max(0, prev.y + dy), w: prev.w, h: prev.h };
        } else if (resizingRef.current) {
          return { x: prev.x, y: prev.y, w: Math.max(40, prev.w + dx), h: Math.max(40, prev.h + dy) };
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

  const onCropImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const dispW = img.clientWidth;
    const dispH = img.clientHeight;
    const short = Math.min(dispW, dispH);
    const size = Math.round(short * 0.48);
    const x = Math.round((dispW - size) / 2);
    const y = Math.round((dispH - size) / 2);
    setCropRect({ x, y, w: size, h: size });
    setSelectingImage(false);
  };

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
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) {
      setNotification({ message: "Could not generate image blob.", type: "error" });
      return;
    }
    const croppedFile = new File([blob], `query-cropped-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    if (rawImageUrl) {
      try {
        URL.revokeObjectURL(rawImageUrl);
      } catch {}
      setRawImageUrl(null);
    }
    setFile(croppedFile);
    const cropUrl = URL.createObjectURL(croppedFile);
    setCroppedPreviewUrl(cropUrl);
    setDrawerOpen(false);
    setPage(1);
    setBadImages(new Set());
  };

  const cancelCropAndClose = () => {
    if (rawImageUrl) {
      try {
        URL.revokeObjectURL(rawImageUrl);
      } catch {}
      setRawImageUrl(null);
    }
    setDrawerOpen(false);
    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
  };

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const dispW = img.clientWidth;
    const dispH = img.clientHeight;
    setCropRect((prev) => {
      const x = Math.min(Math.max(0, prev.x), Math.max(0, dispW - 20));
      const y = Math.min(Math.max(0, prev.y), Math.max(0, dispH - 20));
      const w = Math.min(Math.max(40, prev.w), dispW - x);
      const h = Math.min(Math.max(40, prev.h), dispH - y);
      return { x, y, w, h };
    });
  }, []);

  useEffect(
    () => () => {
      if (rawImageUrl) {
        try {
          URL.revokeObjectURL(rawImageUrl);
        } catch {}
      }
    },
    [rawImageUrl]
  );

  return (
    <div className="search-container">
      <FabricSearchHeader />

      {/* ── Database Control Panel ── */}
      <DbControlPanel />

      {/* ── Hero / Upload area ── */}
      {!file && visibleResults.length === 0 && !loading && !drawerOpen && (
        <header className="hero-area">
          <h1 className="hero-title">
            Here you find all the clothing
            <br />
            items you couldn't find.
            <span className="hero-highlight" aria-hidden />
          </h1>

          <div className="hero-cta">
            {/* Text search */}
            <div className="text-search-row">
              <input
                type="text"
                className="text-search-input"
                placeholder="Search by name, fabric, colour…"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTextSearch()}
              />
              <button
                className="hero-search-btn text-search-submit"
                onClick={handleTextSearch}
                disabled={loading || !textQuery.trim()}
                aria-label="Text search"
              >
                🔎 Search
              </button>
            </div>

            <div className="search-divider"><span>or</span></div>

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

          <style>{`
            .text-search-row {
              display: flex;
              gap: 8px;
              width: 100%;
              max-width: 480px;
            }
            .text-search-input {
              flex: 1;
              padding: 11px 16px;
              border-radius: 8px;
              border: 1.5px solid #2a2d3a;
              background: #0f1117;
              color: #f1f5f9;
              font-size: 14px;
              outline: none;
              transition: border-color 0.18s;
            }
            .text-search-input::placeholder { color: #4b5563; }
            .text-search-input:focus { border-color: #4f46e5; }
            .text-search-submit:disabled { opacity: 0.45; cursor: not-allowed; }
            .search-divider {
              display: flex;
              align-items: center;
              gap: 10px;
              color: #4b5563;
              font-size: 12px;
              letter-spacing: 0.08em;
              width: 100%;
              max-width: 480px;
            }
            .search-divider::before,
            .search-divider::after {
              content: '';
              flex: 1;
              height: 1px;
              background: #2a2d3a;
            }
          `}</style>
        </header>
      )}

      {/* ── Side-by-side preview (original + cropped) ── */}
      {file && !drawerOpen && (
        <div className="side-by-side-preview">
          <div className="original-preview">
            <p className="section-title">Original Image</p>
            <div className="original-img-wrap">
              <img
                className="original-img"
                src={previewUrlOriginal || rawImageUrl || previewUrl || ""}
                alt="original"
              />
              <div className="original-img-actions">
                <button
                  className="btn secondary"
                  onClick={handleClear}
                  aria-label="Clear original"
                  title="Clear"
                >
                  ✕
                </button>
              </div>
              <div className="preview-img-actions">
                <button
                  className="btn"
                  onClick={() => {
                    const orig = originalFileRef.current;
                    if (!orig) {
                      setNotification({
                        message: "Original image not available to re-crop.",
                        type: "error",
                      });
                      return;
                    }
                    if (rawImageUrl) {
                      try {
                        URL.revokeObjectURL(rawImageUrl);
                      } catch {}
                    }
                    const url = URL.createObjectURL(orig);
                    setRawImageUrl(url);
                    setDrawerOpen(true);
                    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
                  }}
                  aria-label="Recrop"
                  title="Recrop"
                >
                  ✂️ Recrop
                </button>
              </div>
            </div>
          </div>

          {croppedPreviewUrl && (
            <div className="cropped-preview">
              <p className="section-title">Cropped Image</p>
              <div className="cropped-img-wrap">
                <div className="preview-img-wrap">
                  <img
                    className="cropped-img preview-img"
                    src={croppedPreviewUrl}
                    alt="cropped"
                  />
                </div>
              </div>
              <div className="preview-actions-below">
                <div className="search-btn-wrapper">
                  <button
                    className="btn primary big-search-btn"
                    onClick={handleSearch}
                    disabled={loading || !file}
                  >
                    🔎 Search
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {notification && (
        <Notification message={notification.message} type={notification.type} />
      )}
      {loading && <Loader />}
      {selectingImage && <Loader />}
      {error && <p className="search-error">{error}</p>}

      {/* ── Results ── */}
      {visibleResults.length > 0 ? (
        <>
          {/* Persistent search bar when showing results */}
          {!file && (
            <div className="results-search-bar">
              <div className="text-search-row">
                <input
                  type="text"
                  className="text-search-input"
                  placeholder="Refine your search…"
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTextSearch()}
                />
                <button
                  className="hero-search-btn text-search-submit"
                  onClick={handleTextSearch}
                  disabled={loading || !textQuery.trim()}
                >
                  🔎
                </button>
                <button
                  className="btn secondary"
                  onClick={handleClear}
                  title="Clear results"
                >
                  ✕ Clear
                </button>
              </div>
            </div>
          )}

          <div className="pagination-controls">
            <button onClick={safePrev} disabled={page === 1}>
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button onClick={safeNext} disabled={page === totalPages}>
              Next
            </button>
          </div>

          <div className="result-grid">
            {paginatedResults.map((item, idx) => (
              <article className="result-card" key={idx}>
                <div className="result-thumb">
                  <img
                    src={toCdnUrl(item.imageSrc)}
                    alt={item.filename}
                    loading="lazy"
                    onError={() => markBadImage(item.imageSrc)}
                    onClick={() => {
                      if (!item.imageSrc) return;
                      openLightbox(toCdnUrl(item.imageSrc), cleanName(item.filename));
                    }}
                    style={{ cursor: "zoom-in" }}
                  />
                  <button
                    type="button"
                    className="zoom-btn"
                    aria-label="Zoom image"
                    title="Zoom"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!item.imageSrc) return;
                      openLightbox(toCdnUrl(item.imageSrc), cleanName(item.filename));
                    }}
                  >
                    🔍
                  </button>
                </div>
                <div
                  className="result-name"
                  onClick={() => {
                    if (!item.imageSrc) return;
                    openLightbox(toCdnUrl(item.imageSrc), cleanName(item.filename));
                  }}
                >
                  {cleanName(item.filename)}
                </div>
                <div className="result-audio">
                  {item.audioSrc && (
                    <audio
                      controls
                      src={item.audioSrc}
                      preload="metadata"
                      controlsList="nodownload"
                    />
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        !loading && file && <p className="empty-hint">No matches found.</p>
      )}

      {/* ── Inline styles for text search / results bar ── */}
      <style>{`
        .results-search-bar {
          margin-bottom: 16px;
        }
        .results-search-bar .text-search-row {
          display: flex;
          gap: 8px;
          max-width: 560px;
        }
      `}</style>

      {/* ── Lightbox ── */}
      {lightboxOpen && activeSrc && (
        <div
          className="lb-backdrop"
          onClick={(e) => {
            if ((e.target as HTMLElement).classList.contains("lb-backdrop"))
              closeLightbox();
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
              <button onClick={() => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))}>
                −
              </button>
              <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>
                Reset
              </button>
              <button onClick={() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP))}>
                +
              </button>
              <button className="lb-close" onClick={closeLightbox}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Crop Drawer ── */}
      {drawerOpen && rawImageUrl && (
        <div className="crop-drawer open" role="dialog" aria-hidden={!drawerOpen}>
          <div className="crop-drawer-inner">
            <h3 className="drawer-title">Crop & Confirm</h3>
            <div className="crop-stage">
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
                    height: `${cropRect.h}px`,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    draggingRef.current = true;
                    lastMouseRef.current = { x: e.clientX, y: e.clientY };
                  }}
                >
                  <div
                    className="crop-handle br"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      resizingRef.current = true;
                      lastMouseRef.current = { x: e.clientX, y: e.clientY };
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="drawer-actions">
              <button className="drawer-btn cancel" onClick={cancelCropAndClose}>
                ✕ Cancel
              </button>
              <button className="drawer-btn confirm" onClick={makeCroppedPreview}>
                ✔ Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}