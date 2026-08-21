import type {
  LanceDataSource,
  LanceStorageType,
} from "@/api/lancedbAdmin";

interface LanceSourceScannerProps {
  value: LanceDataSource;
  loading: boolean;
  error: string | null;
  onChange: (value: LanceDataSource) => void;
  onScan: () => void;
  onLock: () => void;
}

function sourceCopy(storage: LanceStorageType) {
  if (storage === "local") {
    return {
      label: null,
      placeholder: null,
      hint: "Uses the backend's configured LanceDB database. Server folders and files are never exposed in the browser.",
    };
  }

  if (storage === "r2") {
    return {
      label: "R2 LanceDB URI (optional)",
      placeholder: "s3://<R2_BUCKET_NAME>/<database-prefix>",
      hint: "R2 uses an S3-compatible s3:// URI. Leave this empty to use R2_BUCKET_NAME. Do not paste R2_ENDPOINT here; credentials and the endpoint stay on the backend.",
    };
  }

  return {
    label: "S3 database URI (optional)",
    placeholder: "s3://<AWS_BUCKET_NAME>/<database-prefix>",
    hint: "Leave the URI empty to use AWS_BUCKET_NAME. AWS credentials or IAM configuration stay on the backend.",
  };
}

export default function LanceSourceScanner({
  value,
  loading,
  error,
  onChange,
  onScan,
  onLock,
}: LanceSourceScannerProps) {
  const copy = sourceCopy(value.storage);

  const setStorage = (storage: LanceStorageType) => {
    onChange(storage === "local" ? { storage } : { storage, location: "" });
  };

  return (
    <section className="lance-source-card" aria-labelledby="lance-source-title">
      <div className="lance-source-card__heading">
        <div>
          <p className="lance-admin-eyebrow">Step 2 · Database scanner</p>
          <h2 id="lance-source-title">Choose storage and scan tables</h2>
          <p>
            Authentication is complete. The explorer only requests LanceDB tables
            after you choose a storage source and press <strong>Scan tables</strong>.
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
            <option value="local">Local database</option>
            <option value="s3">Amazon S3</option>
            <option value="r2">Cloudflare R2</option>
          </select>
        </label>

        {copy.label && copy.placeholder ? (
          <label className="lance-admin-field lance-admin-field--source-location">
            <span>{copy.label}</span>
            <input
              value={value.location ?? ""}
              onChange={(event) =>
                onChange({ ...value, location: event.target.value })
              }
              placeholder={copy.placeholder}
              disabled={loading}
              maxLength={2048}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : (
          <div className="lance-admin-field lance-admin-field--source-location">
            <span>Database</span>
            <div className="lance-source-card__configured">
              Backend configured LanceDB
            </div>
          </div>
        )}

        <div className="lance-source-card__actions">
          <button
            type="button"
            className="lance-admin-button"
            onClick={onScan}
            disabled={loading}
          >
            {loading ? "Scanning…" : "Scan tables"}
          </button>
        </div>
      </div>

      <p className="lance-source-card__hint">{copy.hint}</p>

      {error && (
        <div className="lance-admin-alert" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
