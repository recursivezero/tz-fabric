import { useState } from "react";
import { USER_FRIENDLY_SERVER_ERROR } from "./searchConfig";
import { callDbEndpoint } from "./searchUtils";
import type { DbOp, NotificationState } from "./types";

export default function DbControlPanel() {
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
      console.error("Database operation failed:", e);
      setNotification({ message: USER_FRIENDLY_SERVER_ERROR, type: "error" });
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
          type="button"
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
          type="button"
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
