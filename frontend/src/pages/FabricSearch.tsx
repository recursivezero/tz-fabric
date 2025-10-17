import { useId, useMemo, useState, useEffect, useRef, useCallback } from "react";
import Loader from "../components/Loader";
import Notification from "../components/Notification";
import useImageSearch from "../hooks/useImageSearch";
import "../styles/Search.css";

export default function Search() {
  const { loading, error, exactMatches, runSearch, clear } = useImageSearch();
  const [file, setFile] = useState<File | null>(null);
  const [k, setK] = useState(0);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const pageSize = 4;
  const [page, setPage] = useState(1);

  // Helper: convert dataURL -> File (stable)
  const dataUrlToFile = useCallback(async (dataUrl: string, filename = "query.png"): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  }, []);

  // Run the sessionStorage auto-load at most once, while keeping ESLint happy
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;

    try {
      const raw = sessionStorage.getItem("mcp_last_search");
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const maybeDataUrl = parsed?.queryPreview;
      const maybeK = parsed?.k ?? parsed?.K ?? parsed?.params?.k ?? 0;

      // Only auto-run if there is a preview and no file currently chosen
      if (maybeDataUrl && !file) {
        didAutoRun.current = true; // ensure we do this only once

        (async () => {
          try {
            const guessName = `query-${Date.now()}.png`;
            const f = await dataUrlToFile(maybeDataUrl, guessName);
            setFile(f);

            if (Number.isFinite(maybeK) && Number(maybeK) > 0) {
              setK(Number(maybeK));
            } else {
              setK(prev => (prev > 0 ? prev : 3));
            }

            await runSearch(f, Number(maybeK) || 3);
          } catch (err) {
            console.error("Auto-run search from mcp_last_search failed:", err);
            setNotification({ message: "Could not auto-run search payload.", type: "error" });
          } finally {
            try {
              sessionStorage.removeItem("mcp_last_search");
            } catch {}
            setPage(1);
          }
        })();
      }
    } catch (err) {
      console.warn("Failed to parse mcp_last_search", err);
    }
  }, [file, runSearch, dataUrlToFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPage(1);
  };

  const cleanName = (filename: string) => {
    if (!filename) return "";
    return filename.split("_")[0].split(".")[0];
    };

  const handleSearch = async () => {
    if (!file) return;
    setNotification(null);
    await runSearch(file, k);
    setPage(1);
  };

  const handleClear = () => {
    setFile(null);
    clear();
    setPage(1);
    setNotification(null);
  };

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * pageSize;
    return exactMatches.slice(start, start + pageSize);
  }, [page, exactMatches]);

  const totalPages = Math.ceil(exactMatches.length / pageSize);
  const fileid = useId();

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="search-container">
      <h2>Similar Images</h2>

      <div className="uploader-row">
        <input
          id={fileid}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="file-input-hidden"
        />
        <label htmlFor={fileid} className="file-button">Choose Image</label>
        <span className="file-name">{file ? file.name : "No file chosen"}</span>

        <label className="k-input">
          K (max results):
          <input
            type="number"
            min={1}
            max={1000}
            value={k}
            onChange={(e) => setK(e.target.valueAsNumber)}
          />
        </label>

        <button onClick={handleSearch} disabled={loading || !file} className="primary-btn">
          {loading ? "Searching..." : "Find Exact"}
        </button>

        <button onClick={handleClear} className="secondary-btn" disabled={loading}>
          Clear
        </button>
      </div>

      {file && (
        <div className="preview-box">
          <p className="section-title">Query Image</p>
          <img className="preview-img" src={previewUrl ?? ""} alt="query" />
        </div>
      )}

      {notification && <Notification message={notification.message} type={notification.type} />}
      {loading && <Loader />}
      {error && <p className="search-error">{error}</p>}

      {exactMatches.length > 0 ? (
        <>
          <div className="pagination-controls">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Prev</button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>Next</button>
          </div>

          <div className="result-grid">
            {paginatedResults.map((item, idx) => (
              <article className="result-card" key={idx}>
                <div className="result-thumb">
                  <img src={item.imageSrc} alt="Uploaded" loading="lazy" />
                </div>
                <div className="result-name" title={item.filename}>
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
        !loading && (
          <p className="empty-hint">
            {file ? "No matches found for this image." : "Pick an image and search."}
          </p>
        )
      )}
    </div>
  );
}
