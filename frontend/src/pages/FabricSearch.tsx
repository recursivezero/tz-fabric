import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import "@/assets/styles/FabricSearch.css";
import Loader from "@/components/Loader";
import { useSearch } from '@/hooks/useSearch';
import type { NotificationState } from '@/types/common';
import { throttle } from "@/utils/throttle";
import { CropDrawer, FabricSearchHeader, Hero, ImagePreview, Lightbox, Notification, ResultsSection, SettingsPanel, StickySearchBar } from '@/components/FabricSearch/components';




// ─── Main Page ────────────────────────────────────────────────────────────────

const FabricSearch = () => {
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
    if (previewUrlOrig) { try { URL.revokeObjectURL(previewUrlOrig); } catch { console.error("Failed to revoke preview URL."); } }
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
    try { window.dispatchEvent(new CustomEvent("fabricai:clear-pending-action")); } catch { console.error("Failed to dispatch clear-pending-action event."); }
  };

  // ── Auto-run ───────────────────────────────────────────────────────────────

  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    const params = new URLSearchParams(window.location.search);
    const urlImage = params.get("image_url");

    const afterRun = () => { try { localStorage.removeItem("mcp_last_search"); } catch { console.error("Failed to remove last search from local storage."); } setPage(1); };

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
        } catch { console.error("Failed to auto-run search from URL."); setNotification({ message: "Could not auto-run search from URL.", type: "error" }); }
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
        } catch { console.error("Failed to auto-run search payload."); setNotification({ message: "Could not auto-run search payload.", type: "error" }); }
        finally { afterRun(); }
      })();
    } catch { console.error("Failed to parse auto-run search payload."); }
  }, [runImageSearch, dataUrlToFile, urlToFile, setOriginalObjectUrl, searchLimit, selectedCategories]);

  // ── Search handlers ────────────────────────────────────────────────────────

  const handleImageSearch = async () => {
    if (!file) return;
    setNotification(null);
    setIsTextSearch(false);
    try { await runImageSearch(file, categoryParam, searchLimit); setPage(1); }
    catch { console.error("Failed to run image search."); setNotification({ message: "Search failed.", type: "error" }); }
  };

  const handleTextSearch = async () => {
    if (!textQuery.trim()) return;
    setNotification(null);
    setIsTextSearch(true);
    try { await runTextSearch(textQuery.trim(), categoryParam, searchLimit); setPage(1); }
    catch { console.error("Failed to run text search."); setNotification({ message: "Search failed.", type: "error" }); }
  };

  const handleCategoryChange = async (cats: string[]) => {
    console.log("Category change triggered with:", cats);
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
    if (rawImageUrl) { try { URL.revokeObjectURL(rawImageUrl); } catch { console.error("Failed to revoke raw image URL."); } setRawImageUrl(null); }
    if (previewUrlOrig) { try { URL.revokeObjectURL(previewUrlOrig); } catch { console.error("Failed to revoke preview URL."); } setPreviewUrlOrig(null); }
    try { window.dispatchEvent(new CustomEvent("fabricai:clear-pending-action")); } catch { console.error("Failed to dispatch clear-pending-action event."); }
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
    if (file) { try { cur = URL.createObjectURL(file); setPreviewUrl(cur); } catch { console.error("Failed to create preview URL."); setPreviewUrl(null); } }
    else setPreviewUrl(null);
    return () => { if (cur) { try { URL.revokeObjectURL(cur); } catch { console.error("Failed to revoke preview URL."); } } };
  }, [file]);

  useEffect(() => () => { if (previewUrlOrig) { try { URL.revokeObjectURL(previewUrlOrig); } catch { console.error("Failed to revoke preview URL."); } } }, [previewUrlOrig]);
  useEffect(() => () => { if (rawImageUrl) { try { URL.revokeObjectURL(rawImageUrl); } catch { console.error("Failed to revoke raw image URL."); } } }, [rawImageUrl]);

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
    try { URL.revokeObjectURL(rawImageUrl); } catch { console.error("Failed to revoke raw image URL."); }
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
    if (rawImageUrl) { try { URL.revokeObjectURL(rawImageUrl); } catch { console.error("Failed to revoke raw image URL."); } setRawImageUrl(null); }
    setDrawerOpen(false);
    setCropRect({ x: 20, y: 20, w: 160, h: 160 });
    setSelectingImage(false);
  };

  const openRecrop = () => {
    const orig = originalFileRef.current;
    if (!orig) { setNotification({ message: "Original image not available.", type: "error" }); return; }
    if (rawImageUrl) { try { URL.revokeObjectURL(rawImageUrl); } catch { console.error("Failed to revoke raw image URL."); } }
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

export default FabricSearch;