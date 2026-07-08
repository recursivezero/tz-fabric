import { useState } from "react";
import DbControlPanel from "./DbControlPanel";

export default function SettingsPanel() {
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
