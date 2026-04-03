import "@/assets/styles/FabricSearch.css";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import FabricSearchHeader from "../components/FabricSearchHeader";
import Loader from "../components/Loader";
import Notification from "../components/Notification";
import { throttle } from "../utils/throttle";

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationState = { message: string; type: "success" | "error" } | null;
type DbOp = "create" | "update" | null;

interface ResultItem {
  imageSrc: string;
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
  results: string[];
  pagination: Pagination;
}

// ─── Category definitions ─────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "stock", label: "Stock", icon: "📦" },
  { id: "fabric", label: "Fabric", icon: "🧵" },
  { id: "design", label: "Design", icon: "🎨" },
  { id: "product", label: "Product", icon: "🖼️" },
  // { id: "group", label: "Group", icon: "👥" }
];

// ─── API helpers ─────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + (import.meta.env.VITE_API_PREFIX ?? "");

const CDN_BASE = import.meta.env.VITE_AWS_PUBLIC_URL ?? "";

function toCdnUrl(src: string | undefined): string {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  return `${CDN_BASE}/images/${src.replace(/^\/+/, "")}`;
}

function toResultItem(raw: string): ResultItem {
  const filename = raw.split("/").pop() ?? raw;
  return { imageSrc: raw, filename };
}

// ─── Search hook ─────────────────────────────────────────────────────────────

function useSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  

  const runImageSearch = useCallback(async (file: File, category?: string[], limit = 40) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("limit", String(limit));
      console.log("FORM DATA CATEGORY:", category);
      console.log("FILE:", file);
      console.log("RUN IMAGE CATEGORY VALUE:", category);
      console.log("TYPE:", typeof category);
      if (category?.length) {
        category.forEach((c) => {
          form.append("category", c);
        });
      }
      const res = await fetch(`${API_BASE}/search`, { method: "POST", body: form });
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

  const runTextSearch = useCallback(async (term: string, category?: string[], limit = 40) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("search_term", term);
      form.append("limit", String(limit));
      if (category?.length) {
        category.forEach((c) => {
          form.append("category", c);
        });
      }
      const res = await fetch(`${API_BASE}/search`, { method: "POST", body: form });
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

// ─── DB endpoint ─────────────────────────────────────────────────────────────

async function callDbEndpoint(op: "create" | "update"): Promise<string> {
  const url = op === "create" ? `${API_BASE}/database/create/table` : `${API_BASE}/database/update/table`;
  const res = await fetch(url, { method: "PUT" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail ?? `Request failed (${res.status})`);
  return data?.message ?? "Done.";
}

// ─── Category Picker ─────────────────────────────────────────────────────────

interface CategoryPickerProps {
  selected: string[];
  onChange: (cats: string[]) => void;
}

function CategoryPicker({ selected, onChange }: CategoryPickerProps) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]);
  const allOn = selected.length === CATEGORIES.length;
  const toggleAll = () => onChange(allOn ? [] : CATEGORIES.map((c) => c.id));

  return (
    <div className="tz-cat-picker tz-glass">
      <div className="tz-cat-header">
        <span className="tz-cat-title">Filter by Category</span>
        <button className="tz-cat-all-btn" onClick={toggleAll} type="button">
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="tz-cat-grid">
        {CATEGORIES.map((cat) => {
          const active = selected.includes(cat.id);
          return (
            <button
              key={cat.id}
              className={`tz-cat-chip${active ? " tz-cat-active" : ""}`}
              onClick={() => toggle(cat.id)}
              type="button"
            >
              <span className="tz-cat-check">{active ? "✓" : ""}</span>
              <span className="tz-cat-icon">{cat.icon}</span>
              <span className="tz-cat-lbl">{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── DB Control Panel ─────────────────────────────────────────────────────────

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
    <div className="tz-db-panel tz-glass">
      <div className="tz-db-header">
        <span className="tz-db-pulse" />
        <span className="tz-db-label">Vector Database</span>
      </div>
      <div className="tz-db-actions">
        <button
          className={`tz-db-btn tz-db-create${activeOp === "create" ? " tz-loading" : ""}`}
          onClick={() => handleOp("create")}
          disabled={!!activeOp}
          title="Rebuild vector table from scratch"
        >
          {activeOp === "create" ? <span className="tz-spinner" /> : <span className="tz-db-icon">⬡</span>}
          Create Table
        </button>
        <button
          className={`tz-db-btn tz-db-update${activeOp === "update" ? " tz-loading" : ""}`}
          onClick={() => handleOp("update")}
          disabled={!!activeOp}
          title="Add new images to existing table"
        >
          {activeOp === "update" ? <span className="tz-spinner" /> : <span className="tz-db-icon">↻</span>}
          Update Table
        </button>
      </div>
      {notification && <div className={`tz-db-notif ${notification.type}`}>{notification.message}</div>}
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="tz-settings-panel">
      <button
        className="tz-settings-toggle tz-btn tz-btn-ghost"
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-expanded={open}
        title="Settings"
      >
        ⚙️ &nbsp;Settings
        <span className="tz-settings-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="tz-settings-content tz-glass">
          <DbControlPanel />
        </div>
      )}
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

  // User-defined search settings
  const [searchLimit, setSearchLimit] = useState(40);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Track whether the last search was a text search (to show category picker in results)
  const [isTextSearch, setIsTextSearch] = useState(false);

  // Derive category param — array or undefined (= no filter)
  const categoryParam = selectedCategories.length > 0 ? selectedCategories : undefined;

  const pageSize = 4;
  const [page, setPage] = useState(1);

  const [badImages, setBadImages] = useState<Set<string>>(new Set());
  const markBadImage = (src?: string) => {
    if (!src) return;
    setBadImages((prev) => new Set([...prev, src]));
  };

  const originalFileRef = useRef<File | null>(null);

  // Crop / drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 20, y: 20, w: 160, h: 160 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);

  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // ── URL helpers ────────────────────────────────────────────────────────────

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
      } else setPreviewUrlOriginal(null);
    },
    [previewUrlOriginal]
  );

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

  // ── File input ─────────────────────────────────────────────────────────────

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    // Reset input so the same file can be re-selected
    e.target.value = "";
    if (!f) return;
    setSelectingImage(true);
    originalFileRef.current = f;
    setOriginalObjectUrl(f);
    const url = URL.createObjectURL(f);
    setRawImageUrl(url);
    setDrawerOpen(true);
    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
    setNotification(null);
    setBadImages(new Set());
    // Clear any previous cropped state
    setCroppedPreviewUrl(null);
    setFile(null);
    setIsTextSearch(false);
    try {
      window.dispatchEvent(new CustomEvent("fabricai:clear-pending-action"));
    } catch {}
  };

  // ── Auto-run from URL / localStorage ──────────────────────────────────────

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
          setIsTextSearch(false);
          await runImageSearch(f, selectedCategories, searchLimit);
        } catch {
          setNotification({ message: "Could not auto-run search from URL.", type: "error" });
        } finally {
          try {
            localStorage.removeItem("mcp_last_search");
          } catch {}
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
          if (parsed?.imageUrl) f = await urlToFile(parsed.imageUrl, `query-${Date.now()}`);
          else if (parsed?.queryPreview) f = await dataUrlToFile(parsed.queryPreview, `query-${Date.now()}.png`);
          if (!f) throw new Error("No usable image in payload.");
          originalFileRef.current = f;
          setOriginalObjectUrl(f);
          setFile(f);
          setIsTextSearch(false);
          await runImageSearch(f, selectedCategories, searchLimit);
        } catch {
          setNotification({ message: "Could not auto-run search payload.", type: "error" });
        } finally {
          try {
            localStorage.removeItem("mcp_last_search");
          } catch {}
          setPage(1);
        }
      })();
    } catch {}
  }, [runImageSearch, dataUrlToFile, urlToFile, setOriginalObjectUrl, searchLimit]);

  // ── Search handlers ────────────────────────────────────────────────────────

  const cleanName = (filename: string) => (filename ? filename.split("_")[0].split(".")[0] : "");

  const handleSearch = async () => {
    if (!file) return;
    setNotification(null);
    setIsTextSearch(false);
    try {
      await runImageSearch(file, categoryParam, searchLimit);
      setPage(1);
    } catch {
      setNotification({ message: "Search failed.", type: "error" });
    }
  };

  const handleTextSearch = async () => {
    if (!textQuery.trim()) return;
    setNotification(null);
    setIsTextSearch(true);
    try {
      await runTextSearch(textQuery.trim(), categoryParam, searchLimit);
      setPage(1);
    } catch {
      setNotification({ message: "Search failed.", type: "error" });
    }
  };

  const handleClear = () => {
    setFile(null);
    setTextQuery("");
    clear();
    setPage(1);
    setNotification(null);
    setBadImages(new Set());
    setIsTextSearch(false);
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

  // ── Results ────────────────────────────────────────────────────────────────

  const visibleResults = useMemo(
    () => results.filter((item) => !item.imageSrc || !badImages.has(item.imageSrc)),
    [results, badImages]
  );

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleResults.slice(start, start + pageSize);
  }, [page, visibleResults]);

  const totalPages = Math.max(1, Math.ceil(visibleResults.length / pageSize));
  const fileid = useId();

  // Preview URL for the file (separate from originalFileRef url)
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

  // ── Lightbox ───────────────────────────────────────────────────────────────

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

  const onLbWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP))));
  };
  const onLbMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    draggingLightboxRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };
  const onLbMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!draggingLightboxRef.current) return;
    const dx = e.clientX - lastPosRef.current.x,
      dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onLbMouseUpOrLeave = () => {
    draggingLightboxRef.current = false;
  };

  // ── Pagination throttle ────────────────────────────────────────────────────

  const safePrev = useMemo(() => throttle(() => setPage((p) => Math.max(1, p - 1)), 1000), []);
  const safeNext = useMemo(() => throttle(() => setPage((p) => Math.min(totalPages, p + 1)), 1000), [totalPages]);

  // ── Crop mouse events ──────────────────────────────────────────────────────

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
        }
        if (resizingRef.current) {
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

  // Called once the image inside the crop drawer loads — centre the crop rect
  const onCropImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const dispW = img.clientWidth,
      dispH = img.clientHeight;
    const short = Math.min(dispW, dispH);
    const size = Math.round(short * 0.55);
    const x = Math.round((dispW - size) / 2);
    const y = Math.round((dispH - size) / 2);
    setCropRect({ x, y, w: size, h: size });
    setSelectingImage(false);
  };

  // Confirm crop → create cropped file + auto-run search
  const makeCroppedPreview = async (): Promise<void> => {
    if (!rawImageUrl || !imgRef.current) return;
    const imgEl = imgRef.current;
    const dispW = imgEl.clientWidth,
      dispH = imgEl.clientHeight;
    const natW = imgEl.naturalWidth,
      natH = imgEl.naturalHeight;
    const sx = Math.round((cropRect.x / dispW) * natW);
    const sy = Math.round((cropRect.y / dispH) * natH);
    const sw = Math.max(1, Math.round((cropRect.w / dispW) * natW));
    const sh = Math.max(1, Math.round((cropRect.h / dispH) * natH));

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
      await new Promise<void>((res, rej) => {
        imgObj.onload = () => res();
        imgObj.onerror = () => rej();
      });
    } catch {
      setNotification({ message: "Could not load image for cropping.", type: "error" });
      return;
    }

    ctx.drawImage(imgObj, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setNotification({ message: "Could not generate cropped image.", type: "error" });
      return;
    }

    const croppedFile = new File([blob], `query-cropped-${Date.now()}.jpg`, { type: "image/jpeg" });

    // Clean up raw url
    try {
      URL.revokeObjectURL(rawImageUrl);
    } catch {}
    setRawImageUrl(null);

    // Store cropped file + preview URL
    setFile(croppedFile);
    setCroppedPreviewUrl(URL.createObjectURL(croppedFile));
    setDrawerOpen(false);
    setPage(1);
    setBadImages(new Set());
    setIsTextSearch(false);

    // Auto-run image search immediately after crop
    setNotification(null);
    try {
      await runImageSearch(croppedFile, selectedCategories, searchLimit);
    } catch {
      setNotification({ message: "Search failed.", type: "error" });
    }
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
    setSelectingImage(false);
  };

  // Cleanup rawImageUrl on unmount
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

  // ── Render ─────────────────────────────────────────────────────────────────

  const showHero = !file && !drawerOpen && visibleResults.length === 0 && !loading;

  return (
    <main className="tz-root">
      {/* Animated canvas background */}

      <div className="search-container">
        <FabricSearchHeader />
        {/* ── Settings Panel (replaces inline DB Control Panel) ── */}
        <div className="db__control">
          <SettingsPanel />
        </div>

        {/* ── Hero / Search entry ── */}
        {showHero && (
          <div>
            <header className="hero-area">
              <div className="hero-eyebrow">Fabric Intelligence</div>
              <h1 className="hero-title">
                Find the clothing
                <br />
                <span className="tz-gold">you couldn't find.</span>
              </h1>
              <p className="hero-sub">Visual &amp; semantic search — powered by vectors</p>
            </header>

            <div className="tz-sc">
              {/* Text search row */}
              <div className="tz-row">
                <input
                  type="text"
                  className="tz-input"
                  placeholder="Search by name, fabric or color"
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTextSearch()}
                />
                <button
                  className="tz-btn tz-btn-primary"
                  onClick={handleTextSearch}
                  disabled={loading || !textQuery.trim()}
                >
                  Search
                </button>
              </div>

              {/* Result limit */}
              <div className="tz-lim">
                <span className="tz-lim-lbl">Results</span>
                <div className="tz-lim-trk">
                  <div className="tz-lim-fill" style={{ width: `${((searchLimit - 5) / 95) * 100}%` }} />
                  <input
                    type="range"
                    className="tz-lim-inp"
                    min={5}
                    max={100}
                    step={5}
                    value={searchLimit}
                    onChange={(e) => setSearchLimit(Number(e.target.value))}
                  />
                </div>
                <span className="tz-lim-val">{searchLimit}</span>
              </div>

              <div className="tz-div">or</div>

              {/* Image search trigger */}
              <input id={fileid} type="file" accept="image/*" onChange={onFileChange} className="file-input-hidden" />
              <button
                className="tz-btn tz-btn-ghost"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => document.getElementById(fileid)?.click()}
              >
                📷  Drop your Image 
              </button>
            </div>

            {/* Category filter */}
            <div style={{ marginTop: 32 }}>
              <CategoryPicker selected={selectedCategories} onChange={setSelectedCategories} />
            </div>
          </div>
        )}
        {/* ── Image preview after crop confirmed ── */}
        {file && !drawerOpen && (
          <div className="side-by-side-preview">
            {/* Original */}
            <div className="original-preview">
              <p className="section-title">Original Image</p>
              <div className="original-img-wrap tz-glass">
                <img className="original-img" src={previewUrlOriginal || previewUrl || ""} alt="original" />
                <div className="original-img-actions">
                  {/* ── Clear Search button ── */}
                  <button
                    className="tz-btn tz-btn-primary"
                    style={{ padding: "6px 14px", fontSize: "12px" }}
                    onClick={handleClear}
                  >
                    🗑️ Clear Search
                  </button>
                </div>
                <div className="preview-img-actions">
                  <button
                    className="tz-btn tz-btn-outline"
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                    onClick={() => {
                      const orig = originalFileRef.current;
                      if (!orig) {
                        setNotification({ message: "Original image not available.", type: "error" });
                        return;
                      }
                      if (rawImageUrl) {
                        try {
                          URL.revokeObjectURL(rawImageUrl);
                        } catch {}
                      }
                      setRawImageUrl(URL.createObjectURL(orig));
                      setDrawerOpen(true);
                      setCropRect({ x: 20, y: 20, w: 160, h: 160 });
                    }}
                  >
                    ✂️ Recrop
                  </button>
                </div>
              </div>
            </div>

            {/* Cropped preview + controls */}
            {croppedPreviewUrl && (
              <>
                <div className="cropped-preview">
                  <p className="section-title">Cropped Image</p>
                  <div className="cropped-img-wrap tz-glass">
                    <img className="cropped-img" src={croppedPreviewUrl} alt="cropped" />
                  </div>
                </div>

                <div className="options">
                  <CategoryPicker selected={selectedCategories} onChange={setSelectedCategories} />
                </div>
                {/* Limit + re-search button */}
                <div className="preview-actions-below">
                  <div className="tz-lim" style={{ flex: 1, maxWidth: 220 }}>
                    <span className="tz-lim-lbl">Limit</span>
                    <div className="tz-lim-trk">
                      <div className="tz-lim-fill" style={{ width: `${((searchLimit - 5) / 95) * 100}%` }} />
                      <input
                        type="range"
                        className="tz-lim-inp"
                        min={5}
                        max={100}
                        step={5}
                        value={searchLimit}
                        onChange={(e) => setSearchLimit(Number(e.target.value))}
                      />
                    </div>
                    <span className="tz-lim-val">{searchLimit}</span>
                  </div>
                  <button className="tz-btn tz-btn-primary" onClick={handleSearch} disabled={loading || !file}>
                    🔎 Search
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Notifications / Loading / Errors ── */}
        {notification && <Notification message={notification.message} type={notification.type} />}
        {(loading || selectingImage) && <Loader />}
        {error && <p className="search-error">{error}</p>}

        {/* ── Results ── */}
        {visibleResults.length > 0 && (
          <>
            <div className="tz-rh">
              <div>
                <div className="tz-rm">
                  <span className="tz-rc">{visibleResults.length}</span>
                  <span className="tz-rl">matches found</span>
                </div>
                {selectedCategories.length > 0 && (
                  <div className="tz-af">
                    <span className="tz-fin">in</span>
                    {selectedCategories.map((c) => (
                      <span key={c} className="tz-badge">
                        {CATEGORIES.find((cat) => cat.id === c)?.icon} {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Refine search bar (text mode) */}
              {!file && (
                <div className="results-search-bar">
                  <div className="tz-row">
                    <input
                      type="text"
                      className="tz-input"
                      placeholder="Refine your search…"
                      value={textQuery}
                      onChange={(e) => setTextQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleTextSearch()}
                    />
                    <button
                      className="tz-btn tz-btn-primary"
                      onClick={handleTextSearch}
                      disabled={loading || !textQuery.trim()}
                    >
                      🔎
                    </button>
                    <button className="tz-btn tz-btn-ghost" onClick={handleClear}>
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Category picker visible after text search ── */}
            {isTextSearch && (
              <div style={{ marginBlock: 20 }}>
                <CategoryPicker selected={selectedCategories} onChange={setSelectedCategories} />
              </div>
            )}

            <div className="pagination-controls">
              <button onClick={safePrev} disabled={page === 1}>
                ← Prev
              </button>
              <span>
                Page {page} / {totalPages}
              </span>
              <button onClick={safeNext} disabled={page === totalPages}>
                Next →
              </button>
            </div>

            <div className="result-grid">
              {paginatedResults.map((item, idx) => (
                <article className="result-card tz-glass" key={idx} style={{ animationDelay: `${idx * 60}ms` }}>
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
                    />
                    <button
                      type="button"
                      className="zoom-btn"
                      aria-label="Zoom"
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
                  {item.audioSrc && (
                    <div className="result-audio">
                      <audio controls src={item.audioSrc} preload="metadata" controlsList="nodownload" />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && file && visibleResults.length === 0 && <p className="empty-hint">— no matches found —</p>}
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && activeSrc && (
        <div
          className="lb-backdrop"
          onClick={(e) => {
            if ((e.target as HTMLElement).classList.contains("lb-backdrop")) closeLightbox();
          }}
        >
          <div
            className="lb-stage"
            onWheel={onLbWheel}
            onMouseDown={onLbMouseDown}
            onMouseMove={onLbMouseMove}
            onMouseUp={onLbMouseUpOrLeave}
            onMouseLeave={onLbMouseUpOrLeave}
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
              <button onClick={() => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))}>−</button>
              <button
                onClick={() => {
                  setScale(1);
                  setOffset({ x: 0, y: 0 });
                }}
              >
                Reset
              </button>
              <button onClick={() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP))}>+</button>
              <button className="lb-close" onClick={closeLightbox}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Crop Drawer ── */}
      {drawerOpen && rawImageUrl && (
        <div className="crop-drawer" role="dialog" aria-modal="true">
          <div className="crop-drawer-inner">
            <h3 className="drawer-title">Crop &amp; Confirm</h3>

            <div className="crop-stage">
              <div className="crop-image-wrap">
                <img
                  ref={imgRef}
                  src={rawImageUrl}
                  alt="Select crop area"
                  className="crop-image"
                  onLoad={onCropImageLoad}
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
                  <div
                    className="crop-handle"
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
              <button className="tz-btn tz-btn-ghost" onClick={cancelCropAndClose}>
                ✕ Cancel
              </button>
              <button className="tz-btn tz-btn-primary" onClick={makeCroppedPreview}>
                ✔ Crop &amp; Search
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
