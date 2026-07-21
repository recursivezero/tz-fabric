import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchWithTimeout } from "../utils/http";
import type { ChangeEvent, MouseEventHandler, WheelEventHandler } from "react";

import Loader from "../components/Loader";
import Notification from "../components/Notification";
import CropDrawer from "../components/search/CropDrawer";
import ImagePreview from "../components/search/ImagePreview";
import Lightbox from "../components/search/Lightbox";
import ResultsSection from "../components/search/ResultsSection";
import SettingsPanel from "../components/search/SettingsPanel";
import SearchHero from "../components/search/SearchHero";
import StickySearchBar from "../components/search/StickySearchBar";
import { MIN_CROP_SIZE } from "../components/search/searchConfig";
import {
  clampCropRectToBounds,
  getSearchLayoutState,
} from "../components/search/searchUtils";
import type { CropRect, NotificationState } from "../components/search/types";
import { useSearch } from "../components/search/useSearch";
import { throttle } from "../utils/throttle";
import "@/assets/styles/FabricSearch.css";
import "@/assets/styles/SearchTextResultsLayout.css";
import "@/assets/styles/SearchSettingsIcon.css";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Search() {
  const { loading, error, results, runImageSearch, runTextSearch, clear } =
    useSearch();

  const [file, setFile] = useState<File | null>(null);
  const [textQuery, setTextQuery] = useState("");
  const [previewUrlOrig, setPreviewUrlOrig] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState>(null);
  const [selectingImage, setSelectingImage] = useState(false);
  const [searchLimit, setSearchLimit] = useState(20);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isTextSearch, setIsTextSearch] = useState(false);
  const [page, setPage] = useState(1);
  const [badImages, setBadImages] = useState<Set<string>>(new Set());

  // Crop / drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect>({
    x: 20,
    y: 20,
    w: 160,
    h: 160,
  });
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(
    null,
  );
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
  const MIN_SCALE = 0.5,
    MAX_SCALE = 6,
    ZOOM_STEP = 0.2;

  const clampLightboxOffset = useCallback(
    (next: { x: number; y: number }) => {
      const viewportWidth =
        typeof window === "undefined" ? 1200 : window.innerWidth;
      const viewportHeight =
        typeof window === "undefined" ? 800 : window.innerHeight;
      const scaleAllowance = Math.max(1, lbScale);
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
    },
    [lbScale],
  );

  // Misc
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const heroFileId = useId();
  const stickyFileId = useId();
  const categoryParam =
    selectedCategories.length > 0 ? selectedCategories : undefined;
  const PAGE_SIZE = 12;

  // ── Object URL helpers ─────────────────────────────────────────────────────

  const setOriginalObjectUrl = useCallback(
    (f: File | null) => {
      if (previewUrlOrig) {
        try {
          URL.revokeObjectURL(previewUrlOrig);
        } catch { /* Best-effort cleanup or browser storage operation. */ }
      }
      setPreviewUrlOrig(
        f
          ? (() => {
              try {
                return URL.createObjectURL(f);
              } catch {
                return null;
              }
            })()
          : null,
      );
    },
    [previewUrlOrig],
  );

  const dataUrlToFile = useCallback(
    async (dataUrl: string, filename = "query.png"): Promise<File> => {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      return new File([blob], filename, { type: blob.type || "image/png" });
    },
    [],
  );

  const urlToFile = useCallback(
    async (url: string, filename = "query.jpg"): Promise<File> => {
      const res = await fetchWithTimeout(url, { credentials: "omit" }, 20_000);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
      const blob = await res.blob();
      const ext = blob.type?.split("/")[1] || "jpg";
      const name = filename.endsWith(`.${ext}`)
        ? filename
        : `${filename}.${ext}`;
      return new File([blob], name, { type: blob.type || "image/jpeg" });
    },
    [],
  );

  // ── File input ─────────────────────────────────────────────────────────────

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
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
    try {
      window.dispatchEvent(new CustomEvent("fabricai:clear-pending-action"));
    } catch { /* Best-effort cleanup or browser storage operation. */ }
  };

  // ── Auto-run ───────────────────────────────────────────────────────────────

  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    const params = new URLSearchParams(window.location.search);
    const urlImage = params.get("image_url");

    const afterRun = () => {
      try {
        localStorage.removeItem("mcp_last_search");
      } catch { /* Best-effort cleanup or browser storage operation. */ }
      setPage(1);
    };

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
          setNotification({
            message: "Could not auto-run search from URL.",
            type: "error",
          });
        } finally {
          afterRun();
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
          if (parsed?.imageUrl)
            f = await urlToFile(parsed.imageUrl, `query-${Date.now()}`);
          else if (parsed?.queryPreview)
            f = await dataUrlToFile(
              parsed.queryPreview,
              `query-${Date.now()}.png`,
            );
          if (!f) throw new Error("No usable image in payload.");
          originalFileRef.current = f;
          setOriginalObjectUrl(f);
          setFile(f);
          setIsTextSearch(false);
          await runImageSearch(f, selectedCategories, searchLimit);
        } catch {
          setNotification({
            message: "Could not auto-run search payload.",
            type: "error",
          });
        } finally {
          afterRun();
        }
      })();
    } catch { /* Best-effort cleanup or browser storage operation. */ }
  }, [
    runImageSearch,
    dataUrlToFile,
    urlToFile,
    setOriginalObjectUrl,
    searchLimit,
    selectedCategories,
  ]);

  // ── Search handlers ────────────────────────────────────────────────────────

  const handleImageSearch = async () => {
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

  const handleCategoryChange = async (cats: string[]) => {
    setSelectedCategories(cats);
    setPage(1);

    // Empty selection = "no filter" — pass undefined so the backend returns all
    // results rather than an empty-array that could resolve to 0 matches.
    const effectiveCats = cats.length > 0 ? cats : undefined;

    if (file && !isTextSearch) {
      await runImageSearch(
        file,
        effectiveCats,
        searchLimit,
        /* preserveResultsOnError */ true,
      );
    } else if (textQuery.trim()) {
      await runTextSearch(
        textQuery.trim(),
        effectiveCats,
        searchLimit,
        /* preserveResultsOnError */ true,
      );
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
      } catch { /* Best-effort cleanup or browser storage operation. */ }
      setRawImageUrl(null);
    }
    if (previewUrlOrig) {
      try {
        URL.revokeObjectURL(previewUrlOrig);
      } catch { /* Best-effort cleanup or browser storage operation. */ }
      setPreviewUrlOrig(null);
    }
    try {
      window.dispatchEvent(new CustomEvent("fabricai:clear-pending-action"));
    } catch { /* Best-effort cleanup or browser storage operation. */ }
    originalFileRef.current = null;
    setCroppedPreviewUrl(null);
  };

  // ── Results helpers ────────────────────────────────────────────────────────

  const visibleResults = useMemo(
    () =>
      results.filter((item) => !item.imageSrc || !badImages.has(item.imageSrc)),
    [results, badImages],
  );

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleResults.slice(start, start + PAGE_SIZE);
  }, [page, visibleResults]);

  const totalPages = Math.max(1, Math.ceil(visibleResults.length / PAGE_SIZE));

  const safePrev = useMemo(
    () => throttle(() => setPage((p) => Math.max(1, p - 1)), 1000),
    [],
  );
  const safeNext = useMemo(
    () => throttle(() => setPage((p) => Math.min(totalPages, p + 1)), 1000),
    [totalPages],
  );

  // ── Preview URL for cropped file ───────────────────────────────────────────

  useEffect(() => {
    let cur: string | null = null;
    if (file) {
      try {
        cur = URL.createObjectURL(file);
        setPreviewUrl(cur);
      } catch {
        setPreviewUrl(null);
      }
    } else setPreviewUrl(null);
    return () => {
      if (cur) {
        try {
          URL.revokeObjectURL(cur);
        } catch { /* Best-effort cleanup or browser storage operation. */ }
      }
    };
  }, [file]);

  useEffect(
    () => () => {
      if (previewUrlOrig) {
        try {
          URL.revokeObjectURL(previewUrlOrig);
        } catch { /* Best-effort cleanup or browser storage operation. */ }
      }
    },
    [previewUrlOrig],
  );
  useEffect(
    () => () => {
      if (rawImageUrl) {
        try {
          URL.revokeObjectURL(rawImageUrl);
        } catch { /* Best-effort cleanup or browser storage operation. */ }
      }
    },
    [rawImageUrl],
  );

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
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setActiveSrc(null);
    setActiveCaption(null);
  };

  useEffect(() => {
    if (!lightboxOpen && !drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (lightboxOpen) {
        setLightboxOpen(false);
        setActiveSrc(null);
        setActiveCaption(null);
        return;
      }

      if (drawerOpen) {
        if (rawImageUrl) {
          try {
            URL.revokeObjectURL(rawImageUrl);
          } catch { /* Best-effort cleanup or browser storage operation. */ }
          setRawImageUrl(null);
        }
        setDrawerOpen(false);
        setCropRect({ x: 20, y: 20, w: 160, h: 160 });
        setSelectingImage(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [lightboxOpen, drawerOpen, rawImageUrl]);

  const onLbWheel: WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setLbScale((s) =>
      Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, s + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)),
      ),
    );
  };
  const onLbMouseDown: MouseEventHandler<HTMLDivElement> = (e) => {
    draggingLbRef.current = true;
    lastLbPosRef.current = { x: e.clientX, y: e.clientY };
  };
  const onLbMouseMove: MouseEventHandler<HTMLDivElement> = (e) => {
    if (!draggingLbRef.current) return;
    const dx = e.clientX - lastLbPosRef.current.x;
    const dy = e.clientY - lastLbPosRef.current.y;
    lastLbPosRef.current = { x: e.clientX, y: e.clientY };
    setLbOffset((o) => clampLightboxOffset({ x: o.x + dx, y: o.y + dy }));
  };
  const onLbMouseUp = () => {
    draggingLbRef.current = false;
  };

  // ── Crop mouse events ──────────────────────────────────────────────────────

  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current && !resizingRef.current) return;
      ev.preventDefault();
      const dx = ev.clientX - lastMouseRef.current.x;
      const dy = ev.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: ev.clientX, y: ev.clientY };
      const img = imgRef.current;
      const imgWidth = img?.clientWidth ?? 0;
      const imgHeight = img?.clientHeight ?? 0;

      setCropRect((prev) => {
        if (draggingRef.current) {
          return clampCropRectToBounds(
            { ...prev, x: prev.x + dx, y: prev.y + dy },
            imgWidth,
            imgHeight,
          );
        }

        if (resizingRef.current) {
          return clampCropRectToBounds(
            { ...prev, w: prev.w + dx, h: prev.h + dy },
            imgWidth,
            imgHeight,
          );
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
    const dispW = img.clientWidth,
      dispH = img.clientHeight;
    if (dispW <= 0 || dispH <= 0) {
      setSelectingImage(false);
      return;
    }

    const short = Math.min(dispW, dispH);
    const size = Math.max(MIN_CROP_SIZE, Math.round(short * 0.55));
    setCropRect(
      clampCropRectToBounds(
        {
          x: Math.round((dispW - size) / 2),
          y: Math.round((dispH - size) / 2),
          w: size,
          h: size,
        },
        dispW,
        dispH,
      ),
    );
    setSelectingImage(false);
  };

  const makeCroppedPreview = async (): Promise<void> => {
    if (!rawImageUrl || !imgRef.current) return;
    const imgEl = imgRef.current;
    const dispW = imgEl.clientWidth,
      dispH = imgEl.clientHeight;
    const natW = imgEl.naturalWidth,
      natH = imgEl.naturalHeight;
    const boundedCropRect = clampCropRectToBounds(cropRect, dispW, dispH);
    if (
      boundedCropRect.x !== cropRect.x ||
      boundedCropRect.y !== cropRect.y ||
      boundedCropRect.w !== cropRect.w ||
      boundedCropRect.h !== cropRect.h
    ) {
      setCropRect(boundedCropRect);
    }

    const sx = Math.round((boundedCropRect.x / dispW) * natW);
    const sy = Math.round((boundedCropRect.y / dispH) * natH);
    const sw = Math.max(1, Math.round((boundedCropRect.w / dispW) * natW));
    const sh = Math.max(1, Math.round((boundedCropRect.h / dispH) * natH));

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
      setNotification({
        message: "Could not load image for cropping.",
        type: "error",
      });
      return;
    }

    ctx.drawImage(imgObj, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) {
      setNotification({
        message: "Could not generate cropped image.",
        type: "error",
      });
      return;
    }

    const croppedFile = new File([blob], `query-cropped-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    try {
      URL.revokeObjectURL(rawImageUrl);
    } catch { /* Best-effort cleanup or browser storage operation. */ }
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
    if (rawImageUrl) {
      try {
        URL.revokeObjectURL(rawImageUrl);
      } catch { /* Best-effort cleanup or browser storage operation. */ }
      setRawImageUrl(null);
    }
    setDrawerOpen(false);
    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
    setSelectingImage(false);
  };

  const openRecrop = () => {
    const orig = originalFileRef.current;
    if (!orig) {
      setNotification({
        message: "Original image not available.",
        type: "error",
      });
      return;
    }
    if (rawImageUrl) {
      try {
        URL.revokeObjectURL(rawImageUrl);
      } catch { /* Best-effort cleanup or browser storage operation. */ }
    }
    setRawImageUrl(URL.createObjectURL(orig));
    setDrawerOpen(true);
    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const hasResults = visibleResults.length > 0;
  const {
    keepTextSearchWorkspace,
    showHero,
    showStickyBar,
    showImagePreview,
  } = getSearchLayoutState({
    hasResults,
    loading,
    hasFile: !!file,
    drawerOpen,
    isTextSearch,
  });
  const stickyPreview = croppedPreviewUrl || previewUrlOrig || previewUrl;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main
      className={`fabric-search${showStickyBar ? " fabric-search--has-results" : ""}${showImagePreview ? " fabric-search--previewing" : ""}${keepTextSearchWorkspace ? " fabric-search--text-results" : ""}`}
    >
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
      <div
        className={`fabric-search__body${showStickyBar ? " fabric-search__body--results" : ""}`}
      >
        {/* Header + settings — hidden while results are shown */}
        {!showStickyBar && (
          <div className="fabric-search__top-bar">
            <div className="fabric-search__settings">
              <SettingsPanel />
            </div>
          </div>
        )}

        {/* Hero */}
        {showHero && (
          <SearchHero
            textQuery={textQuery}
            setTextQuery={setTextQuery}
            onTextSearch={handleTextSearch}
            onClear={handleClear}
            showClear={keepTextSearchWorkspace}
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
        {showImagePreview && (
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

        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
          />
        )}
        {error && (
          <div
            className="fabric-search__error"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}
        {(loading || selectingImage) && (
          <div
            className="fabric-search__loading-overlay"
            role="status"
            aria-live="polite"
          >
            <Loader />
          </div>
        )}
        {/* Results */}
        {hasResults && (
          <ResultsSection
            results={visibleResults}
            paginatedResults={paginatedResults}
            page={page}
            totalPages={totalPages}
            selectedCategories={selectedCategories}
            onSetCategories={handleCategoryChange}
            onPrev={safePrev}
            onNext={safeNext}
            onZoom={openLightbox}
            isTextSearch={isTextSearch}
            onBadImage={(src) =>
              setBadImages((prev) => new Set([...prev, src]))
            }
          />
        )}

        {!loading &&
          (file || isTextSearch) &&
          visibleResults.length === 0 &&
          !error && (
            <p className="fabric-search__empty">
              {isTextSearch && textQuery.trim()
                ? `No results found for “${textQuery.trim()}”. Try another keyword or category.`
                : "No matching fabrics found. Try changing crop, category, or result limit."}
            </p>
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
          onZoomOut={() =>
            setLbScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))
          }
          onReset={() => {
            setLbScale(1);
            setLbOffset({ x: 0, y: 0 });
          }}
        />
      )}

      {/* Crop drawer */}
      {drawerOpen && rawImageUrl && imgRef !== null && (
        <CropDrawer
          rawImageUrl={rawImageUrl}
          cropRect={cropRect}
          imgRef={imgRef}
          onImageLoad={onCropImageLoad}
          onDragStart={(e) => {
            draggingRef.current = true;
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
          }}
          onResizeStart={(e) => {
            resizingRef.current = true;
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
          }}
          onConfirm={makeCroppedPreview}
          onCancel={cancelCropAndClose}
        />
      )}
    </main>
  );
}
