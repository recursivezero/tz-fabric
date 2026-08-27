import { useEffect, useRef } from "react";
import type { LanceRowDetail, LanceRowSummary } from "@/api/lancedbAdmin";
import { completeRowCopyPayload } from "./explorerUtils";

interface VectorViewerProps {
  row: LanceRowSummary | null;
  detail: LanceRowDetail | null;
  loading: boolean;
  error: string | null;
  returnFocusElement: HTMLButtonElement | null;
  onClose: () => void;
  onCopy: (value: string, successMessage: string) => void;
  onRetry: () => void;
}

export default function VectorViewer({
  row,
  detail,
  loading,
  error,
  returnFocusElement,
  onClose,
  onCopy,
  onRetry,
}: VectorViewerProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!row) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));

      if (focusable.length === 0) {
        event.preventDefault();
        closeRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusElement?.focus();
    };
  }, [onClose, returnFocusElement, row]);

  if (!row) return null;

  return (
    <div className="lance-vector-modal" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="lance-vector-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lance-vector-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="lance-admin-eyebrow">Lazy row detail</p>
            <h2 id="lance-vector-title">Vector for row {row.row_id}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="lance-vector-modal__close"
            onClick={onClose}
            aria-label="Close vector viewer"
          >
            ×
          </button>
        </header>

        {loading && (
          <div className="lance-admin-grid-state" role="status">
            Loading full vector…
          </div>
        )}
        {error && (
          <div className="lance-admin-alert" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
        {detail && (
          <>
            <dl className="lance-vector-modal__summary">
              <div>
                <dt>Dimensions</dt>
                <dd>{detail.vector.length.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Tag</dt>
                <dd>{detail.tag ?? "—"}</dd>
              </div>
              <div>
                <dt>Hash</dt>
                <dd>{detail.hash ?? "—"}</dd>
              </div>
            </dl>
            <pre className="lance-vector-modal__values">
              {JSON.stringify(detail.vector.values, null, 2)}
            </pre>
            <div className="lance-vector-modal__actions">
              <button
                type="button"
                className="lance-admin-button"
                onClick={() =>
                  onCopy(
                    completeRowCopyPayload(detail),
                    "Complete row JSON copied",
                  )
                }
              >
                Copy complete row
              </button>
              <button
                type="button"
                className="lance-admin-button lance-admin-button--secondary"
                onClick={() =>
                  onCopy(JSON.stringify(detail.vector.values), "Vector copied")
                }
              >
                Copy vector
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
