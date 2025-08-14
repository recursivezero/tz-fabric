import { useMemo, useState } from "react";
import useImageSearch from "../hooks/search";
import "../styles/Search.css";
import { useNavigate } from "react-router-dom";

export default function Search() {
  const { loading, error, exactMatches, runSearch, clear } = useImageSearch();
  const [file, setFile] = useState<File | null>(null);
  const [k, setK] = useState(1);
  const navigate = useNavigate()

  const pageSize = 4; 
  const [page, setPage] = useState(1);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPage(1);
  };

  const handleSearch = async () => {
    if (!file) return;
    await runSearch(file, k);
    setPage(1);
  };

  const handleClear = () => {
    setFile(null);
    clear();
    setPage(1);
  };

  const handleEdit = (item: any) => {
    const md = item?.raw?.metadata || {};
    const mediaId =
      md.id || md._id || md.mediaId || md.filename || md.relPath || null;
    navigate("/upload", {
      state: {
        prefill: {
          id: mediaId,
          imageUrl: item.imageSrc || null,
          audioUrl: item.audioSrc || null,
          filename: item.filename || null,
          metadata: md,
        },
        mode: "edit",
      },
    });
  };
  
  const paginatedResults = useMemo(() => {
    const start = (page - 1) * pageSize;
    return exactMatches.slice(start, start + pageSize);
  }, [page, exactMatches]);

  const totalPages = Math.ceil(exactMatches.length / pageSize);

  return (
    <div className="search-container">
      <h2>Exact Matches Only (Most Recent • Score 1.0000)</h2>

      {/* Uploader + controls */}
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
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>

          <div className="result-grid">
            {paginatedResults.map((item, idx) => (
              <article className="result-card" key={idx}>
                <div className="result-thumb">
                  <img
                    src={item.imageSrc}
                    alt="Uploaded"
                    loading="lazy"
                  />
                </div>

                <div className="result-audio">
                  {item.audioSrc && (
                    <audio
                      controls
                      src={item.audioSrc}
                      preload="metadata"
                    />
                  )}
                </div>
                <div className="result-actions">
                  <button
                    className="btn-edit"
                    onClick={() => handleEdit(item)}
                    title="Edit this media"
                  >
                    ✎ Edit
                  </button>
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
