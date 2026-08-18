import type {
  LanceDataSource,
  LanceLocalBrowseResponse,
  LanceStorageType,
} from "@/api/lancedbAdmin";

interface LanceSourceScannerProps {
  value: LanceDataSource;
  loading: boolean;
  error: string | null;
  browser: LanceLocalBrowseResponse | null;
  browserLoading: boolean;
  browserError: string | null;
  onChange: (value: LanceDataSource) => void;
  onScan: () => void;
  onBrowse: (path?: string) => void;
  onCloseBrowser: () => void;
  onLock: () => void;
}

export default function LanceSourceScanner({
  value,
  loading,
  error,
  browser,
  browserLoading,
  browserError,
  onChange,
  onScan,
  onBrowse,
  onCloseBrowser,
  onLock,
}: LanceSourceScannerProps) {
  const setStorage = (storage: LanceStorageType) => {
    onCloseBrowser();
    onChange({ storage, location: "" });
  };

  return (
    <section className="lance-source-card" aria-labelledby="lance-source-title">
      <div className="lance-source-card__heading">
        <div>
          <p className="lance-admin-eyebrow">Step 2 · Database scanner</p>
          <h2 id="lance-source-title">Scan a LanceDB location</h2>
          <p>
            Authentication is complete. No database is scanned until you choose a
            location and press <strong>Scan database</strong>.
          </p>
        </div>
        <button
          type="button"
          className="lance-admin-button lance-admin-button--quiet"
          onClick={onLock}
        >
          Lock explorer
        </button>
      </div>

      <div className="lance-source-card__grid">
        <label className="lance-admin-field">
          <span>Storage</span>
          <select
            value={value.storage}
            onChange={(event) =>
              setStorage(event.target.value as LanceStorageType)
            }
            disabled={loading}
          >
            <option value="local">Local / server filesystem</option>
            <option value="s3">Amazon S3</option>
          </select>
        </label>

        <label className="lance-admin-field lance-admin-field--source-location">
          <span>{value.storage === "s3" ? "S3 URI" : "Directory path"}</span>
          <input
            value={value.location}
            onChange={(event) =>
              onChange({ ...value, location: event.target.value })
            }
            placeholder={
              value.storage === "s3"
                ? "s3://bucket/path/to/lancedb"
                : "C:\\data\\fabric.lancedb or /srv/data/fabric.lancedb"
            }
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <div className="lance-source-card__actions">
          {value.storage === "local" && (
            <button
              type="button"
              className="lance-admin-button lance-admin-button--secondary"
              onClick={() => onBrowse(value.location || undefined)}
              disabled={loading || browserLoading}
            >
              {browserLoading ? "Opening…" : "Browse server"}
            </button>
          )}
          <button
            type="button"
            className="lance-admin-button"
            onClick={onScan}
            disabled={loading || !value.location.trim()}
          >
            {loading ? "Scanning…" : "Scan database"}
          </button>
        </div>
      </div>

      <p className="lance-source-card__hint">
        {value.storage === "s3"
          ? "The backend uses its AWS environment variables or IAM role. AWS credentials are never entered in this browser. R2 can be added later through the same S3-compatible source contract."
          : "Browse selects a directory on the backend server, not a folder from the administrator's device."}
      </p>

      {error && (
        <div className="lance-admin-alert" role="alert">
          {error}
        </div>
      )}

      {value.storage === "local" && (browser || browserError) && (
        <div
          className="lance-source-browser"
          role="region"
          aria-label="Server directory browser"
        >
          <div className="lance-source-browser__header">
            <div>
              <span>Current directory</span>
              <code>{browser?.current_path ?? value.location}</code>
            </div>
            <button
              type="button"
              className="lance-admin-button lance-admin-button--quiet"
              onClick={onCloseBrowser}
            >
              Close browser
            </button>
          </div>

          {browserError ? (
            <div className="lance-admin-alert" role="alert">
              {browserError}
            </div>
          ) : (
            <>
              <div className="lance-source-browser__actions">
                <button
                  type="button"
                  className="lance-admin-button lance-admin-button--secondary"
                  onClick={() =>
                    browser &&
                    onChange({ storage: "local", location: browser.current_path })
                  }
                  disabled={!browser}
                >
                  Use this folder
                </button>
                {browser?.parent_path && (
                  <button
                    type="button"
                    className="lance-admin-button lance-admin-button--secondary"
                    onClick={() => onBrowse(browser.parent_path ?? undefined)}
                  >
                    Up one level
                  </button>
                )}
              </div>
              <div className="lance-source-browser__list">
                {browser?.directories.length ? (
                  browser.directories.map((directory) => (
                    <button
                      type="button"
                      key={directory.path}
                      onClick={() => onBrowse(directory.path)}
                    >
                      <span aria-hidden="true">📁</span>
                      <strong>{directory.name}</strong>
                      <code>{directory.path}</code>
                    </button>
                  ))
                ) : (
                  <p>No child directories are available.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
