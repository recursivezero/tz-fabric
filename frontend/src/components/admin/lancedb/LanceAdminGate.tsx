import { type FormEvent, useId, useState } from "react";
import type { LanceExplorerCredentials } from "@/api/lancedbAdmin";

interface LanceAdminGateProps {
  loading: boolean;
  error: string | null;
  onUnlock: (credentials: LanceExplorerCredentials) => void;
}

const EMPTY_CREDENTIALS: LanceExplorerCredentials = {
  adminSecret: "",
  s3: {
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    region: "",
    bucketName: "",
  },
  r2: {
    accessKeyId: "",
    secretAccessKey: "",
    accountId: "",
    bucketName: "",
    endpoint: "",
    region: "auto",
  },
};

function validateCredentialSet(credentials: LanceExplorerCredentials): string | null {
  if (!credentials.adminSecret.trim()) {
    return "Enter the internal administrator secret.";
  }

  const s3 = credentials.s3;
  const hasAnyS3 = Object.values(s3).some((value) => value.trim());
  if (
    hasAnyS3 &&
    (!s3.accessKeyId.trim() ||
      !s3.secretAccessKey ||
      !s3.region.trim() ||
      !s3.bucketName.trim())
  ) {
    return "For Amazon S3, enter the access key, secret key, region, and bucket name. The session token is optional.";
  }

  const r2 = credentials.r2;
  const hasAnyR2 = Object.values(r2).some(
    (value) => value.trim() && value.trim() !== "auto",
  );
  if (
    hasAnyR2 &&
    (!r2.accessKeyId.trim() ||
      !r2.secretAccessKey ||
      !r2.bucketName.trim() ||
      (!r2.endpoint.trim() && !r2.accountId.trim()))
  ) {
    return "For Cloudflare R2, enter the access key, secret key, bucket name, and either the endpoint or account ID.";
  }

  return null;
}

export default function LanceAdminGate({
  loading,
  error,
  onUnlock,
}: LanceAdminGateProps) {
  const prefix = useId();
  const [credentials, setCredentials] =
    useState<LanceExplorerCredentials>(EMPTY_CREDENTIALS);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateCredentialSet(credentials);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    onUnlock({
      adminSecret: credentials.adminSecret.trim(),
      s3: {
        ...credentials.s3,
        accessKeyId: credentials.s3.accessKeyId.trim(),
        region: credentials.s3.region.trim(),
        bucketName: credentials.s3.bucketName.trim(),
      },
      r2: {
        ...credentials.r2,
        accessKeyId: credentials.r2.accessKeyId.trim(),
        accountId: credentials.r2.accountId.trim(),
        bucketName: credentials.r2.bucketName.trim(),
        endpoint: credentials.r2.endpoint.trim(),
        region: credentials.r2.region.trim() || "auto",
      },
    });
  };

  return (
    <section className="lance-admin-gate" aria-labelledby="lance-admin-gate-title">
      <div className="lance-admin-gate__icon" aria-hidden="true">
        🔐
      </div>
      <p className="lance-admin-eyebrow">Step 1 · Admin session setup</p>
      <h1 id="lance-admin-gate-title">LanceDB Explorer</h1>
      <p className="lance-admin-gate__copy">
        Enter the administrator secret and the object-storage credentials you
        need for this session. Cloud credentials are optional when you only use
        the local database.
      </p>

      <form className="lance-admin-gate__form" onSubmit={submit}>
        <fieldset className="lance-admin-credential-section">
          <legend>Administrator access</legend>
          <label htmlFor={`${prefix}-admin-secret`}>Internal administrator secret</label>
          <input
            id={`${prefix}-admin-secret`}
            type="password"
            value={credentials.adminSecret}
            onChange={(event) =>
              setCredentials((current) => ({
                ...current,
                adminSecret: event.target.value,
              }))
            }
            placeholder="INTERNAL_API_KEY"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            disabled={loading}
            required
          />
        </fieldset>

        <fieldset className="lance-admin-credential-section">
          <legend>Amazon S3 (optional)</legend>
          <div className="lance-admin-credential-grid">
            <label htmlFor={`${prefix}-s3-access`}>Access key ID</label>
            <input
              id={`${prefix}-s3-access`}
              value={credentials.s3.accessKeyId}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  s3: { ...current.s3, accessKeyId: event.target.value },
                }))
              }
              placeholder="AWS_ACCESS_KEY_ID"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />

            <label htmlFor={`${prefix}-s3-secret`}>Secret access key</label>
            <input
              id={`${prefix}-s3-secret`}
              type="password"
              value={credentials.s3.secretAccessKey}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  s3: { ...current.s3, secretAccessKey: event.target.value },
                }))
              }
              placeholder="AWS_SECRET_ACCESS_KEY"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />

            <label htmlFor={`${prefix}-s3-region`}>Region</label>
            <input
              id={`${prefix}-s3-region`}
              value={credentials.s3.region}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  s3: { ...current.s3, region: event.target.value },
                }))
              }
              placeholder="ap-south-1"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />

            <label htmlFor={`${prefix}-s3-bucket`}>Bucket name</label>
            <input
              id={`${prefix}-s3-bucket`}
              value={credentials.s3.bucketName}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  s3: { ...current.s3, bucketName: event.target.value },
                }))
              }
              placeholder="AWS_BUCKET_NAME"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />
          </div>

          <label htmlFor={`${prefix}-s3-token`}>Session token (optional)</label>
          <input
            id={`${prefix}-s3-token`}
            type="password"
            value={credentials.s3.sessionToken}
            onChange={(event) =>
              setCredentials((current) => ({
                ...current,
                s3: { ...current.s3, sessionToken: event.target.value },
              }))
            }
            placeholder="AWS_SESSION_TOKEN"
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
          />
        </fieldset>

        <fieldset className="lance-admin-credential-section">
          <legend>Cloudflare R2 (optional)</legend>
          <div className="lance-admin-credential-grid">
            <label htmlFor={`${prefix}-r2-access`}>Access key ID</label>
            <input
              id={`${prefix}-r2-access`}
              value={credentials.r2.accessKeyId}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  r2: { ...current.r2, accessKeyId: event.target.value },
                }))
              }
              placeholder="R2_ACCESS_KEY_ID"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />

            <label htmlFor={`${prefix}-r2-secret`}>Secret access key</label>
            <input
              id={`${prefix}-r2-secret`}
              type="password"
              value={credentials.r2.secretAccessKey}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  r2: { ...current.r2, secretAccessKey: event.target.value },
                }))
              }
              placeholder="R2_SECRET_ACCESS_KEY"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />

            <label htmlFor={`${prefix}-r2-bucket`}>Bucket name</label>
            <input
              id={`${prefix}-r2-bucket`}
              value={credentials.r2.bucketName}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  r2: { ...current.r2, bucketName: event.target.value },
                }))
              }
              placeholder="R2_BUCKET_NAME"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />

            <label htmlFor={`${prefix}-r2-account`}>Account ID</label>
            <input
              id={`${prefix}-r2-account`}
              value={credentials.r2.accountId}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  r2: { ...current.r2, accountId: event.target.value },
                }))
              }
              placeholder="R2_ACCOUNT_ID"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />

            <label htmlFor={`${prefix}-r2-endpoint`}>Endpoint</label>
            <input
              id={`${prefix}-r2-endpoint`}
              value={credentials.r2.endpoint}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  r2: { ...current.r2, endpoint: event.target.value },
                }))
              }
              placeholder="https://<account-id>.r2.cloudflarestorage.com"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />

            <label htmlFor={`${prefix}-r2-region`}>Region</label>
            <input
              id={`${prefix}-r2-region`}
              value={credentials.r2.region}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  r2: { ...current.r2, region: event.target.value },
                }))
              }
              placeholder="auto"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />
          </div>
        </fieldset>

        <button
          type="submit"
          className="lance-admin-button"
          disabled={loading || !credentials.adminSecret.trim()}
        >
          {loading ? "Checking access…" : "Open explorer"}
        </button>
      </form>

      {(formError || error) && (
        <div className="lance-admin-alert" role="alert">
          {formError ?? error}
        </div>
      )}

      <p className="lance-admin-gate__privacy">
        Credentials are kept only in React memory for this page session. They are
        not written to localStorage, sessionStorage, cookies, or public frontend
        environment variables. Cloud credentials are sent only to the private
        LanceDB API over the current HTTP(S) connection when that storage type is
        selected.
      </p>
    </section>
  );
}
