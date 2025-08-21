import { useMemo, useState } from "react";
import useImageSearch from "../hooks/search";
import "../styles/Search.css";
import Notification from "../components/Notification";
import Loader from "../components/Loader";

export default function Search() {
  const { loading, error, exactMatches, runSearch, clear } = useImageSearch();
  const [file, setFile] = useState<File | null>(null);
  const [k, setK] = useState(1);
  const [notification, setNotification] = useState<{ message: string, type: "success" | "error" } | null>(null);


  const pageSize = 4;
  const [page, setPage] = useState(1);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPage(1);
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

  return (
    <div className="search-container">
      <h2>Exact Matches Only (Most Recent • Score 1.0000)</h2>

      <div className="uploader-row">
        <input
          id="file-input"
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="file-input-hidden"
        />
        <label htmlFor="file-input" className="file-button">
          Choose Image
        </label>
        <span className="file-name">{file ? file.name : "No file chosen"}</span>

        <label className="k-input">
          K (max results):
          <input
            type="number"
            min={1}
            max={1000}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
          />
        </label>

        <button
          onClick={handleSearch}
          disabled={loading || !file}
          className="primary-btn"
        >
          {loading ? "Searching..." : "Find Exact"}
        </button>

        <button
          onClick={handleClear}
          className="secondary-btn"
          disabled={loading}
        >
          Clear
        </button>
      </div>

      {notification && (
        <Notification message={notification.message} type={notification.type} />
      )}
      {loading && <Loader />}
      {error && <p className="search-error">{error}</p>}

      {file && (
        <div className="preview-box">
          <p className="section-title">Query Image</p>
          <img
            className="preview-img"
            src={URL.createObjectURL(file)}
            alt="query"
          />
        </div>
      )}

      {exactMatches.length > 0 ? (
        <>
          <div className="pagination-controls">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
              Next
            </button>
          </div>

          <div className="result-grid">
            {paginatedResults.map((item, idx) => (
              <article className="result-card" key={idx}>
                <div className="result-thumb">
                  <img src={item.imageSrc} alt="Uploaded" loading="lazy" />
                </div>

                <div className="result-audio">
                  {item.audioSrc && (
                    <audio controls src={item.audioSrc} preload="metadata" />
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        !loading && (
          <p className="empty-hint">
            {file
              ? "No exact (1.0000) matches found for this image."
              : "Pick an image and search."}
          </p>
        )
      )}
    </div>
  );
}
