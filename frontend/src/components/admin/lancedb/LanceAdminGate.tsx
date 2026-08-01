import { type FormEvent, useId, useState } from "react";

interface LanceAdminGateProps {
  loading: boolean;
  error: string | null;
  onUnlock: (secret: string) => void;
}

export default function LanceAdminGate({
  loading,
  error,
  onUnlock,
}: LanceAdminGateProps) {
  const inputId = useId();
  const [value, setValue] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const secret = value.trim();
    if (secret) onUnlock(secret);
  };

  return (
    <section className="lance-admin-gate" aria-labelledby="lance-admin-gate-title">
      <div className="lance-admin-gate__icon" aria-hidden="true">
        🔐
      </div>
      <p className="lance-admin-eyebrow">Private administrator tool</p>
      <h1 id="lance-admin-gate-title">LanceDB Explorer</h1>
      <p className="lance-admin-gate__copy">
        Enter the internal administrator secret to inspect read-only table,
        schema, metadata, and row information.
      </p>
      <form className="lance-admin-gate__form" onSubmit={submit}>
        <label htmlFor={inputId}>Internal administrator secret</label>
        <input
          id={inputId}
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Enter configured secret"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          disabled={loading}
          required
        />
        <button type="submit" className="lance-admin-button" disabled={loading || !value.trim()}>
          {loading ? "Checking access…" : "Open explorer"}
        </button>
      </form>
      {error && (
        <div className="lance-admin-alert" role="alert">
          {error}
        </div>
      )}
      <p className="lance-admin-gate__privacy">
        Use the server-side <code>INTERNAL_API_KEY</code> value. The secret is
        held only in this page session and is not placed in a public frontend
        environment variable.
      </p>
    </section>
  );
}
