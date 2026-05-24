// ─── DbControlPanel ───────────────────────────────────────────────────────────

import type { DbOp, NotificationState } from '@/types/common';
import { useState } from 'react';
import { callDbEndpoint } from '@/utils/search.helper';

export const DbControlPanel = () => {
  const [activeOp, setActiveOp] = useState<DbOp>(null);
  const [notification, setNotification] = useState<NotificationState>(null);

  const handleOp = async (op: "create" | "update") => {
    if (activeOp) return;
    setActiveOp(op);
    setNotification(null);
    try {
      const msg = await callDbEndpoint(op);
      setNotification({ message: msg, type: "success" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Operation failed.";
      setNotification({ message: msg, type: "error" });
    } finally {
      setActiveOp(null);
    }
  };

  return (
    <div className="db-panel">
      <div className="db-panel__header">
        <span className="db-panel__pulse" />
        <span className="db-panel__label">Vector Database</span>
      </div>

      <div className="db-panel__actions">
        <button
          className={`db-panel__btn db-panel__btn--create${activeOp === "create" ? " db-panel__btn--loading" : ""}`}
          onClick={() => handleOp("create")}
          disabled={!!activeOp}
          title="Rebuild vector table from scratch"
        >
          {activeOp === "create"
            ? <span className="db-panel__spinner" />
            : <span className="db-panel__btn-icon">⬡</span>}
          Create Table
        </button>

        <button
          className={`db-panel__btn db-panel__btn--update${activeOp === "update" ? " db-panel__btn--loading" : ""}`}
          onClick={() => handleOp("update")}
          disabled={!!activeOp}
          title="Add new images to existing table"
        >
          {activeOp === "update"
            ? <span className="db-panel__spinner" />
            : <span className="db-panel__btn-icon">↻</span>}
          Update Table
        </button>
      </div>

      {notification && (
        <div className={`db-panel__notification db-panel__notification--${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────

export const SettingsPanel = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="settings-panel">
      <button
        className="settings-panel__toggle"
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-expanded={open}
        title="Settings"
      >
        ⚙️ &nbsp;Settings
        <span className="settings-panel__chevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="settings-panel__content">
          <DbControlPanel />
        </div>
      )}
    </div>
  );
}
