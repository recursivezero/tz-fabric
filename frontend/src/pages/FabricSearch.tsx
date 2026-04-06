import {  useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import FabricSearchHeader from "../components/FabricSearchHeader";
import Loader from "../components/Loader";
import Notification from "../components/Notification";
import { throttle } from "../utils/throttle";
import "@/assets/styles/FabricSearch.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationState = { message: string; type: "success" | "error" } | null;
type DbOp = "create" | "update" | null;

interface ResultItem {
  imageSrc: string;
  filename: string;
  audioSrc?: string;
}

interface SearchApiResponse {
  message: string;
  results: string[];
  pagination: {
    page: number;
    per_page: number;
    total_results: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "stock", label: "Stock", icon: "📦" },
  { id: "fabric", label: "Fabric", icon: "🧵" },
  { id: "design", label: "Design", icon: "🎨" },
  { id: "product", label: "Product", icon: "🖼️" },
];

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + (import.meta.env.VITE_API_PREFIX ?? "");
const CDN_BASE = import.meta.env.VITE_AWS_PUBLIC_URL ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toCdnUrl(src: string | undefined): string {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  return `${CDN_BASE}/images/${src.replace(/^\/+/, "")}`;
}

function toResultItem(raw: string): ResultItem {
  const filename = raw.split("/").pop() ?? raw;
  return { imageSrc: raw, filename };
}

function cleanName(filename: string): string {
  return filename ? filename.split("_")[0].split(".")[0] : "";
}

// ─── useSearch hook ───────────────────────────────────────────────────────────

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
      if (category?.length) category.forEach((c) => { form.append("category", c) });
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
      if (category?.length) category.forEach((c) => { form.append("category", c) });
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

// ─── DB endpoint ──────────────────────────────────────────────────────────────

async function callDbEndpoint(op: "create" | "update"): Promise<string> {
  const url =
    op === "create"
      ? `${API_BASE}/database/create/table`
      : `${API_BASE}/database/update/table`;
  const res = await fetch(url, { method: "PUT" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail ?? `Request failed (${res.status})`);
  return data?.message ?? "Done.";
}

// ─── CategoryPicker ───────────────────────────────────────────────────────────

interface CategoryPickerProps {
  selected: string[];
  onChange: (cats: string[]) => void;
  compact?: boolean;
}

function CategoryPicker({ selected, onChange, compact = false }: CategoryPickerProps) {
  const [tempSelected, setTempSelected] = useState(selected);
  const toggle = (id: string) => {
    setTempSelected(tempSelected.includes(id) ? tempSelected.filter((c) => c !== id) : [...tempSelected, id]);
  }
  const allOn = tempSelected.length === CATEGORIES.length;
  const toggleAll = () => {setTempSelected(allOn ? [] : CATEGORIES.map((c) => c.id))};

  const applySearch = () => {
    console.log("Apply search with categories:", tempSelected);
    onChange(tempSelected);
  };

  useEffect(() => {
    setTempSelected(selected);
  }, [selected]);

  return (
    <div className={`category-picker${compact ? " category-picker--compact" : ""}`}>
      <div className="category-picker__header">
        <span className="category-picker__title">Filter by Category</span>
        <button className="category-picker__toggle-all" onClick={toggleAll} type="button">
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>

      <div className="category-picker__grid">
        {CATEGORIES.map((cat) => {
          const active = tempSelected.includes(cat.id);
          return (
            <button
              key={cat.id}
              className={`category-picker__chip${active ? " category-picker__chip--active" : ""}`}
              onClick={() => toggle(cat.id)}
              type="button"
            >
              <span className="category-picker__chip-check">{active ? "✓" : ""}</span>
              <span className="category-picker__chip-icon">{cat.icon}</span>
              <span className="category-picker__chip-label">{cat.label}</span>
            </button>
          );
        })}
        {compact && (
          <button className="btn btn-primary" onClick={()=> applySearch()} type="button">
            {'Apply filter →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── DbControlPanel ───────────────────────────────────────────────────────────

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
    <div className="db-panel">
      <div className="db-panel__header">
        <span className="db-panel__pulse" />
        <span className="db-panel__label">Vector Database</span>
      </div>

      <div className="db-panel__actions">
        <button
          className={`db-panel__btn db-panel__btn--create${activeOp === "create" ? " db-panel__btn--loading" : ""}`}
          onClick={() => handleOp("create")}
          disabled={!!activeOp}
          title="Rebuild vector table from scratch"
        >
          {activeOp === "create"
            ? <span className="db-panel__spinner" />
            : <span className="db-panel__btn-icon">⬡</span>}
          Create Table
        </button>

        <button
          className={`db-panel__btn db-panel__btn--update${activeOp === "update" ? " db-panel__btn--loading" : ""}`}
          onClick={() => handleOp("update")}
          disabled={!!activeOp}
          title="Add new images to existing table"
        >
          {activeOp === "update"
            ? <span className="db-panel__spinner" />
            : <span className="db-panel__btn-icon">↻</span>}
          Update Table
        </button>
      </div>

      {notification && (
        <div className={`db-panel__notification db-panel__notification--${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────

function SettingsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="settings-panel">
      <button
        className="settings-panel__toggle"
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-expanded={open}
        title="Settings"
      >
        ⚙️ &nbsp;Settings
        <span className="settings-panel__chevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="settings-panel__content">
          <DbControlPanel />
        </div>
      )}
    </div>
  );
}

// ─── StickySearchBar ──────────────────────────────────────────────────────────

interface StickySearchBarProps {
  textQuery: string;
  setTextQuery: (v: string) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  isImageMode: boolean;
  previewUrl: string | null;
  onRecrop: () => void;
  fileInputId: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedCategories: string[];
  onSetCategories: (cats: string[]) => void;
  searchLimit: number;
  onSetLimit: (v: number) => void;
}

function StickySearchBar({
  textQuery,
  setTextQuery,
  onSearch,
  onClear,
  loading,
  isImageMode,
  previewUrl,
  onRecrop,
  fileInputId,
  onFileChange,

  selectedCategories,
  onSetCategories,
  searchLimit,
  onSetLimit,
}: StickySearchBarProps) {
  return (
    <div className="search-bar search-bar--sticky">
      <div className="search-bar__inner">

        {isImageMode && previewUrl ? (
          <div className="search-bar__image-row">
            <div className="search-bar__thumb-wrap">
              <img src={previewUrl} alt="query" className="search-bar__thumb" />
            </div>

            <div className="search-bar__image-actions">
              <button className="btn btn--outline btn--sm" onClick={onRecrop}>
                ✂️ Recrop
              </button>

              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="search-bar__file-input"
              />

              <button
                className="btn btn--ghost btn--sm"
                onClick={() => document.getElementById(fileInputId)?.click()}
              >
                📷 New Image
              </button>
            </div>
          </div>
        ) : (
          <div className="search-bar__text-row">
            <div className="search-bar__input-wrap">
              <input
                type="text"
                className="search-bar__input"
                placeholder="Refine search…"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
              />
            </div>

            <button
              className="btn btn--primary btn--sm"
              onClick={onSearch}
              disabled={loading || !textQuery.trim()}
            >
              Search
            </button>
          </div>
        )}

        <button className="btn btn--ghost btn--sm" onClick={onClear}>
          ✕ Clear
        </button>
      </div>

      {/* ✅ NEW: filters always visible */}
      <div className="search-bar__filters">
        <CategoryPicker
          selected={selectedCategories}
          onChange={onSetCategories}
          compact
        />

        <LimitSlider
          value={searchLimit}
          onChange={onSetLimit}
          label="Limit"
        />
      </div>
    </div>
  );
}
// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  variant?: "inline" | "bottom";
}

function Pagination({ page, totalPages, onPrev, onNext, variant = "bottom" }: PaginationProps) {
  return (
    <div className={`pagination pagination--${variant}`}>
      <button className="pagination__btn" onClick={onPrev} disabled={page === 1}>
        ← Prev
      </button>
      <span className="pagination__label">Page {page} / {totalPages}</span>
      <button className="pagination__btn" onClick={onNext} disabled={page === totalPages}>
        Next →
      </button>
    </div>
  );
}

// ─── ResultCard ───────────────────────────────────────────────────────────────

interface ResultCardProps {
  item: ResultItem;
  index: number;
  onZoom: (src: string, caption: string) => void;
  onBadImage: (src: string) => void;
}

function ResultCard({ item, index, onZoom, onBadImage }: ResultCardProps) {
  const handleClick = () => {
    if (!item.imageSrc) return;
    onZoom(toCdnUrl(item.imageSrc), cleanName(item.filename));
  };

  return (
    <article
      className="result-card"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="result-card__thumb">
        <img
          src={toCdnUrl(item.imageSrc)}
          alt={item.filename}
          loading="lazy"
          onError={() => onBadImage(item.imageSrc)}
          onClick={handleClick}
        />
        <button
          type="button"
          className="result-card__zoom-btn"
          aria-label="Zoom"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
        >
          🔍
        </button>
      </div>

      <div className="result-card__name" onClick={handleClick}>
        {cleanName(item.filename)}
      </div>

      {item.audioSrc && (
        <div className="result-card__audio">
          <audio controls src={item.audioSrc} preload="metadata" controlsList="nodownload" />
        </div>
      )}
    </article>
  );
}

// ─── ResultsSection ───────────────────────────────────────────────────────────

interface ResultsSectionProps {
  results: ResultItem[];
  paginatedResults: ResultItem[];
  page: number;
  totalPages: number;
  selectedCategories: string[];
  isTextSearch: boolean;
  onSetCategories: (cats: string[]) => void;
  onPrev: () => void;
  onNext: () => void;
  onZoom: (src: string, caption: string) => void;
  onBadImage: (src: string) => void;
}

function ResultsSection({
  results,
  paginatedResults,
  page,
  totalPages,
  onPrev,
  onNext,
  onZoom,
  onBadImage,
}: ResultsSectionProps) {
  return (
    <div className="results-section">

      <div className="results-section__meta">
        <div>{results.length} results</div>
        <Pagination page={page} totalPages={totalPages} onPrev={onPrev} onNext={onNext} />
      </div>

      {/* ✅ ALWAYS visible */}
      {/* <div className="results-section__filters one">
        <CategoryPicker selected={selectedCategories} onChange={onSetCategories} compact />
      </div> */}

      <div className="result-grid result-grid--full">
        {paginatedResults.map((item: any, idx: number) => (
          <ResultCard
            key={idx}
            item={item}
            index={idx}
            onZoom={onZoom}
            onBadImage={onBadImage}
          />
        ))}
      </div>
    </div>
  );
}

// ─── LimitSlider ──────────────────────────────────────────────────────────────

interface LimitSliderProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}

function LimitSlider({ value, onChange, label = "Results" }: LimitSliderProps) {
  return (
    <div className="limit-slider">
      <span className="limit-slider__label">{label}</span>
      <div className="limit-slider__track">
        <div
          className="limit-slider__fill"
          style={{ width: `${((value - 5) / 95) * 100}%` }}
        />
        <input
          type="range"
          className="limit-slider__input"
          min={5} max={100} step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <span className="limit-slider__value">{value}</span>
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

interface LightboxProps {
  src: string;
  caption: string | null;
  scale: number;
  offset: { x: number; y: number };
  onClose: () => void;
  onWheel: React.WheelEventHandler<HTMLDivElement>;
  onMouseDown: React.MouseEventHandler<HTMLDivElement>;
  onMouseMove: React.MouseEventHandler<HTMLDivElement>;
  onMouseUp: React.MouseEventHandler<HTMLDivElement>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

function Lightbox({
  src, caption, scale, offset,
  onClose, onWheel, onMouseDown, onMouseMove, onMouseUp,
  onZoomIn, onZoomOut, onReset,
}: LightboxProps) {
  return (
    <div
      className="lightbox"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains("lightbox")) onClose();
      }}
    >
      <div
        className="lightbox__stage"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <img
          src={src}
          alt={caption ?? "preview"}
          className="lightbox__image"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          draggable={false}
        />

        {caption && <div className="lightbox__caption">{caption}</div>}

        <div className="lightbox__controls">
          <button className="lightbox__control-btn" onClick={onZoomOut}>−</button>
          <button className="lightbox__control-btn" onClick={onReset}>Reset</button>
          <button className="lightbox__control-btn" onClick={onZoomIn}>+</button>
          <button className="lightbox__control-btn lightbox__control-btn--close" onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ─── CropDrawer ───────────────────────────────────────────────────────────────

interface CropDrawerProps {
  rawImageUrl: string;
  cropRect: { x: number; y: number; w: number; h: number };
  imgRef: React.RefObject<HTMLImageElement | null>;
  onImageLoad: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function CropDrawer({
  rawImageUrl, cropRect, imgRef,
  onImageLoad, onDragStart, onResizeStart,
  onConfirm, onCancel,
}: CropDrawerProps) {
  return (
    <div className="crop-drawer" role="dialog" aria-modal="true">
      <div className="crop-drawer__inner">
        <h3 className="crop-drawer__title">Crop &amp; Confirm</h3>

        <div className="crop-drawer__stage">
          <div className="crop-drawer__image-wrap">
            <img
              ref={imgRef}
              src={rawImageUrl}
              alt="Select crop area"
              className="crop-drawer__image"
              onLoad={onImageLoad}
              draggable={false}
            />
            <div
              className="crop-drawer__rect"
              style={{
                left: `${cropRect.x}px`,
                top: `${cropRect.y}px`,
                width: `${cropRect.w}px`,
                height: `${cropRect.h}px`,
              }}
              onMouseDown={(e) => { e.preventDefault(); onDragStart(e); }}
            >
              <div
                className="crop-drawer__handle"
                onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
              />
            </div>
          </div>
        </div>

        <div className="crop-drawer__actions">
          <button className="btn btn--ghost" onClick={onCancel}>✕ Cancel</button>
          <button className="btn btn--primary" onClick={onConfirm}>✔ Crop &amp; Search</button>
        </div>
      </div>
    </div>
  );
}

// ─── ImagePreview (pre-results, post-crop) ────────────────────────────────────

interface ImagePreviewProps {
  originalUrl: string;
  croppedUrl: string | null;
  searchLimit: number;
  selectedCategories: string[];
  loading: boolean;
  onClear: () => void;
  onRecrop: () => void;
  onSetCategories: (cats: string[]) => void;
  onSetLimit: (v: number) => void;
  onSearch: () => void;
}

function ImagePreview({
  originalUrl, croppedUrl, searchLimit,
  selectedCategories, loading,
  onClear, onRecrop, onSetCategories, onSetLimit, onSearch,
}: ImagePreviewProps) {
  return (
    <div className="image-preview">
      {/* Original */}
      <div className="image-preview__pane">
        <p className="image-preview__pane-title">Original Image</p>
        <div className="image-preview__frame">
          <img className="image-preview__img" src={originalUrl} alt="original" />
          <div className="image-preview__frame-actions image-preview__frame-actions--top">
            <button
              className="btn btn--primary btn--sm"
              onClick={onClear}
            >
              🗑️ Clear Search
            </button>
          </div>
          <div className="image-preview__frame-actions image-preview__frame-actions--bottom">
            <button className="btn btn--outline btn--sm" onClick={onRecrop}>
              ✂️ Recrop
            </button>
          </div>
        </div>
      </div>

      {/* Cropped */}
      {croppedUrl && (
        <>
          <div className="image-preview__pane">
            <p className="image-preview__pane-title">Cropped Image</p>
            <div className="image-preview__frame">
              <img className="image-preview__img" src={croppedUrl} alt="cropped" />
            </div>
          </div>

          <div className="image-preview__options">
            <CategoryPicker selected={selectedCategories} onChange={onSetCategories} />
          </div>

          <div className="image-preview__search-row">
            <LimitSlider value={searchLimit} onChange={onSetLimit} label="Limit" />
            <button
              className="btn btn--primary"
              onClick={onSearch}
              disabled={loading}
            >
              🔎 Search
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

interface HeroProps {
  textQuery: string;
  setTextQuery: (v: string) => void;
  onTextSearch: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputId: string;
  searchLimit: number;
  onSetLimit: (v: number) => void;
  selectedCategories: string[];
  onSetCategories: (cats: string[]) => void;
  loading: boolean;
}

function Hero({
  textQuery, setTextQuery, onTextSearch,
  onFileChange, fileInputId,
  searchLimit, onSetLimit,
  selectedCategories, onSetCategories,
  loading,
}: HeroProps) {
  return (
    <div className="hero">
      <header className="hero__header">
        <div className="hero__eyebrow">Fabric Intelligence</div>
        <h1 className="hero__title">
          Find the clothing
          <br />
          <span className="hero__title-accent">you couldn't find.</span>
        </h1>
        <p className="hero__subtitle">Visual &amp; semantic search — powered by vectors</p>
      </header>

      <div className="hero__search-controls">
        {/* Text search */}
        <div className="hero__search-row">
          <input
            type="text"
            className="hero__search-input"
            placeholder="Search by name, fabric or color"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onTextSearch()}
          />
          <button
            className="btn btn--primary"
            onClick={onTextSearch}
            disabled={loading || !textQuery.trim()}
          >
            Search
          </button>
        </div>

        {/* Limit */}
        <LimitSlider value={searchLimit} onChange={onSetLimit} />

        {/* Divider */}
        <div className="hero__divider">or</div>

        {/* Image upload */}
        <input
          id={fileInputId}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hero__file-input"
        />
        <button
          className="btn btn--ghost hero__upload-btn"
          onClick={() => document.getElementById(fileInputId)?.click()}
        >
          📷 Drop your Image
        </button>
      </div>

      {/* Category filter */}
      <div className="hero__categories">
        <CategoryPicker selected={selectedCategories} onChange={onSetCategories} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Search() {
  const { loading, error, results, runImageSearch, runTextSearch, clear } = useSearch();

  const [file, setFile] = useState<File | null>(null);
  const [textQuery, setTextQuery] = useState("");
  const [previewUrlOrig, setPreviewUrlOrig] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState>(null);
  const [selectingImage, setSelectingImage] = useState(false);
  const [searchLimit, setSearchLimit] = useState(40);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isTextSearch, setIsTextSearch] = useState(false);
  const [page, setPage] = useState(1);
  const [badImages, setBadImages] = useState<Set<string>>(new Set());

  // Crop / drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 20, y: 20, w: 160, h: 160 });
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const originalFileRef = useRef<File | null>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);
  const [lbScale, setLbScale] = useState(1);
  const [lbOffset, setLbOffset] = useState({ x: 0, y: 0 });
  const draggingLbRef = useRef(false);
  const lastLbPosRef = useRef({ x: 0, y: 0 });
  const MIN_SCALE = 0.5, MAX_SCALE = 6, ZOOM_STEP = 0.2;

  // Misc
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const heroFileId = useId();
  const stickyFileId = useId();
  const categoryParam = selectedCategories.length > 0 ? selectedCategories : undefined;
  const PAGE_SIZE = 12;

  // ── Object URL helpers ─────────────────────────────────────────────────────

  const setOriginalObjectUrl = useCallback((f: File | null) => {
    if (previewUrlOrig) { try { URL.revokeObjectURL(previewUrlOrig); } catch { } }
    setPreviewUrlOrig(f ? (() => { try { return URL.createObjectURL(f); } catch { return null; } })() : null);
  }, [previewUrlOrig]);

  const dataUrlToFile = useCallback(async (dataUrl: string, filename = "query.png"): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  }, []);

  const urlToFile = useCallback(async (url: string, filename = "query.jpg"): Promise<File> => {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const blob = await res.blob();
    const ext = (blob.type?.split("/")[1]) || "jpg";
    const name = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  }, []);

  // ── File input ─────────────────────────────────────────────────────────────

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
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
    setCroppedPreviewUrl(null);
    setFile(null);
    setIsTextSearch(false);
    try { window.dispatchEvent(new CustomEvent("fabricai:clear-pending-action")); } catch { }
  };

  // ── Auto-run ───────────────────────────────────────────────────────────────

  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    const params = new URLSearchParams(window.location.search);
    const urlImage = params.get("image_url");

    const afterRun = () => { try { localStorage.removeItem("mcp_last_search"); } catch { } setPage(1); };

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
        } catch { setNotification({ message: "Could not auto-run search from URL.", type: "error" }); }
        finally { afterRun(); }
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
        } catch { setNotification({ message: "Could not auto-run search payload.", type: "error" }); }
        finally { afterRun(); }
      })();
    } catch { }
  }, [runImageSearch, dataUrlToFile, urlToFile, setOriginalObjectUrl, searchLimit, selectedCategories]);

  // ── Search handlers ────────────────────────────────────────────────────────

  const handleImageSearch = async () => {
    if (!file) return;
    setNotification(null);
    setIsTextSearch(false);
    try { await runImageSearch(file, categoryParam, searchLimit); setPage(1); }
    catch { setNotification({ message: "Search failed.", type: "error" }); }
  };

  const handleTextSearch = async () => {
    if (!textQuery.trim()) return;
    setNotification(null);
    setIsTextSearch(true);
    try { await runTextSearch(textQuery.trim(), categoryParam, searchLimit); setPage(1); }
    catch { setNotification({ message: "Search failed.", type: "error" }); }
  };

  const handleCategoryChange = async (cats: string[]) => {
    setSelectedCategories(cats);
    setPage(1);

    if (file && !isTextSearch) {
      await runImageSearch(file, cats, searchLimit);
    } else if (textQuery.trim()) {
      await runTextSearch(textQuery.trim(), cats, searchLimit);
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
    if (rawImageUrl) { try { URL.revokeObjectURL(rawImageUrl); } catch { } setRawImageUrl(null); }
    if (previewUrlOrig) { try { URL.revokeObjectURL(previewUrlOrig); } catch { } setPreviewUrlOrig(null); }
    try { window.dispatchEvent(new CustomEvent("fabricai:clear-pending-action")); } catch { }
    originalFileRef.current = null;
    setCroppedPreviewUrl(null);
  };

  // ── Results helpers ────────────────────────────────────────────────────────

  const visibleResults = useMemo(
    () => results.filter((item) => !item.imageSrc || !badImages.has(item.imageSrc)),
    [results, badImages]
  );

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleResults.slice(start, start + PAGE_SIZE);
  }, [page, visibleResults]);

  const totalPages = Math.max(1, Math.ceil(visibleResults.length / PAGE_SIZE));

  const safePrev = useMemo(() => throttle(() => setPage((p) => Math.max(1, p - 1)), 1000), []);
  const safeNext = useMemo(() => throttle(() => setPage((p) => Math.min(totalPages, p + 1)), 1000), [totalPages]);

  // ── Preview URL for cropped file ───────────────────────────────────────────

  useEffect(() => {
    let cur: string | null = null;
    if (file) { try { cur = URL.createObjectURL(file); setPreviewUrl(cur); } catch { setPreviewUrl(null); } }
    else setPreviewUrl(null);
    return () => { if (cur) { try { URL.revokeObjectURL(cur); } catch { } } };
  }, [file]);

  useEffect(() => () => { if (previewUrlOrig) { try { URL.revokeObjectURL(previewUrlOrig); } catch { } } }, [previewUrlOrig]);
  useEffect(() => () => { if (rawImageUrl) { try { URL.revokeObjectURL(rawImageUrl); } catch { } } }, [rawImageUrl]);

  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");
    return () => wrapper?.classList.remove("upload-bg");
  }, []);

  // ── Lightbox ───────────────────────────────────────────────────────────────

  const openLightbox = (src: string, caption?: string) => {
    setActiveSrc(src);
    setActiveCaption(caption ?? null);
    setLbScale(1);
    setLbOffset({ x: 0, y: 0 });
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
    setLbScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP))));
  };
  const onLbMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    draggingLbRef.current = true;
    lastLbPosRef.current = { x: e.clientX, y: e.clientY };
  };
  const onLbMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!draggingLbRef.current) return;
    const dx = e.clientX - lastLbPosRef.current.x;
    const dy = e.clientY - lastLbPosRef.current.y;
    lastLbPosRef.current = { x: e.clientX, y: e.clientY };
    setLbOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onLbMouseUp = () => { draggingLbRef.current = false; };

  // ── Crop mouse events ──────────────────────────────────────────────────────

  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current && !resizingRef.current) return;
      ev.preventDefault();
      const dx = ev.clientX - lastMouseRef.current.x;
      const dy = ev.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: ev.clientX, y: ev.clientY };
      setCropRect((prev) => {
        if (draggingRef.current) return { x: Math.max(0, prev.x + dx), y: Math.max(0, prev.y + dy), w: prev.w, h: prev.h };
        if (resizingRef.current) return { x: prev.x, y: prev.y, w: Math.max(40, prev.w + dx), h: Math.max(40, prev.h + dy) };
        return prev;
      });
    };
    const onUp = () => { draggingRef.current = false; resizingRef.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const onCropImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const dispW = img.clientWidth, dispH = img.clientHeight;
    const short = Math.min(dispW, dispH);
    const size = Math.round(short * 0.55);
    setCropRect({ x: Math.round((dispW - size) / 2), y: Math.round((dispH - size) / 2), w: size, h: size });
    setSelectingImage(false);
  };

  const makeCroppedPreview = async (): Promise<void> => {
    if (!rawImageUrl || !imgRef.current) return;
    const imgEl = imgRef.current;
    const dispW = imgEl.clientWidth, dispH = imgEl.clientHeight;
    const natW = imgEl.naturalWidth, natH = imgEl.naturalHeight;
    const sx = Math.round((cropRect.x / dispW) * natW);
    const sy = Math.round((cropRect.y / dispH) * natH);
    const sw = Math.max(1, Math.round((cropRect.w / dispW) * natW));
    const sh = Math.max(1, Math.round((cropRect.h / dispH) * natH));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setNotification({ message: "Could not crop image.", type: "error" }); return; }

    const imgObj = new Image();
    imgObj.crossOrigin = "anonymous";
    imgObj.src = rawImageUrl;
    try { await new Promise<void>((res, rej) => { imgObj.onload = () => res(); imgObj.onerror = () => rej(); }); }
    catch { setNotification({ message: "Could not load image for cropping.", type: "error" }); return; }

    ctx.drawImage(imgObj, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) { setNotification({ message: "Could not generate cropped image.", type: "error" }); return; }

    const croppedFile = new File([blob], `query-cropped-${Date.now()}.jpg`, { type: "image/jpeg" });
    try { URL.revokeObjectURL(rawImageUrl); } catch { }
    setRawImageUrl(null);
    setFile(croppedFile);
    setCroppedPreviewUrl(URL.createObjectURL(croppedFile));
    setDrawerOpen(false);
    setPage(1);
    setBadImages(new Set());
    setIsTextSearch(false);
    setNotification(null);
    // try { await runImageSearch(croppedFile, selectedCategories, searchLimit); }
    // catch { setNotification({ message: "Search failed.", type: "error" }); }
  };

  const cancelCropAndClose = () => {
    if (rawImageUrl) { try { URL.revokeObjectURL(rawImageUrl); } catch { } setRawImageUrl(null); }
    setDrawerOpen(false);
    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
    setSelectingImage(false);
  };

  const openRecrop = () => {
    const orig = originalFileRef.current;
    if (!orig) { setNotification({ message: "Original image not available.", type: "error" }); return; }
    if (rawImageUrl) { try { URL.revokeObjectURL(rawImageUrl); } catch { } }
    setRawImageUrl(URL.createObjectURL(orig));
    setDrawerOpen(true);
    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const hasResults = visibleResults.length > 0;
  const showHero = !file && !drawerOpen && !hasResults && !loading && !isTextSearch;
  const showStickyBar = hasResults || (loading && (!!file || isTextSearch));
  const stickyPreview = croppedPreviewUrl || previewUrlOrig || previewUrl;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className={`fabric-search${showStickyBar ? " fabric-search--has-results" : ""}`}>

      {/* Sticky search bar */}
      {showStickyBar && (
        <StickySearchBar
          textQuery={textQuery}
          setTextQuery={setTextQuery}
          onSearch={isTextSearch ? handleTextSearch : handleImageSearch}
          onClear={handleClear}
          loading={loading}
          isImageMode={!!file && !isTextSearch}
          previewUrl={stickyPreview}
          onRecrop={openRecrop}
          fileInputId={stickyFileId}
          onFileChange={onFileChange}

          selectedCategories={selectedCategories}
          onSetCategories={handleCategoryChange}
          searchLimit={searchLimit}
          onSetLimit={setSearchLimit}
        />
      )}

      {/* Page body */}
      <div className={`fabric-search__body${showStickyBar ? " fabric-search__body--results" : ""}`}>

        {/* Header + settings — hidden while results are shown */}
        {!showStickyBar && (
          <div className="fabric-search__top-bar">
            <FabricSearchHeader />
            <div className="fabric-search__settings">
              <SettingsPanel />
            </div>
          </div>
        )}

        {/* Hero */}
        {showHero && (
          <Hero
            textQuery={textQuery}
            setTextQuery={setTextQuery}
            onTextSearch={handleTextSearch}
            onFileChange={onFileChange}
            fileInputId={heroFileId}
            searchLimit={searchLimit}
            onSetLimit={setSearchLimit}
            selectedCategories={selectedCategories}
            onSetCategories={handleCategoryChange}
            loading={loading}
          />
        )}

        {/* Image preview (post-crop, pre-results) */}
        {file && !drawerOpen && !hasResults && !loading && (
          <ImagePreview
            originalUrl={previewUrlOrig || previewUrl || ""}
            croppedUrl={croppedPreviewUrl}
            searchLimit={searchLimit}
            selectedCategories={selectedCategories}
            loading={loading}
            onClear={handleClear}
            onRecrop={openRecrop}
            onSetCategories={handleCategoryChange}
            onSetLimit={setSearchLimit}
            onSearch={handleImageSearch}
          />
        )}

        {/* Notifications / states */}
        {notification && <Notification message={notification.message} type={notification.type} />}
        {(loading || selectingImage) && <Loader />}
        {error && <p className="fabric-search__error">{error}</p>}

        {/* Results */}
        {hasResults && (
          <ResultsSection
            results={visibleResults}
            paginatedResults={paginatedResults}
            page={page}
            totalPages={totalPages}
            selectedCategories={selectedCategories}
            onSetCategories={handleCategoryChange}   // ✅ FIXED
            onPrev={safePrev}
            onNext={safeNext}
            onZoom={openLightbox}
            isTextSearch={isTextSearch}
            onBadImage={(src) => setBadImages((prev) => new Set([...prev, src]))}
          />
        )}

        {!loading && file && visibleResults.length === 0 && (
          <p className="fabric-search__empty">— no matches found —</p>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && activeSrc && (
        <Lightbox
          src={activeSrc}
          caption={activeCaption}
          scale={lbScale}
          offset={lbOffset}
          onClose={closeLightbox}
          onWheel={onLbWheel}
          onMouseDown={onLbMouseDown}
          onMouseMove={onLbMouseMove}
          onMouseUp={onLbMouseUp}
          onZoomIn={() => setLbScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP))}
          onZoomOut={() => setLbScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))}
          onReset={() => { setLbScale(1); setLbOffset({ x: 0, y: 0 }); }}
        />
      )}

      {/* Crop drawer */}
      {drawerOpen && rawImageUrl && imgRef !== null && (
        <CropDrawer
          rawImageUrl={rawImageUrl}
          cropRect={cropRect}
          imgRef={imgRef}
          onImageLoad={onCropImageLoad}
          onDragStart={(e) => { draggingRef.current = true; lastMouseRef.current = { x: e.clientX, y: e.clientY }; }}
          onResizeStart={(e) => { resizingRef.current = true; lastMouseRef.current = { x: e.clientX, y: e.clientY }; }}
          onConfirm={makeCroppedPreview}
          onCancel={cancelCropAndClose}
        />
      )}
    </main>
  );
}
