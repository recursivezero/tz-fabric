import { useState } from "react";
import { FiSettings } from "react-icons/fi";
import DbControlPanel from "./DbControlPanel";

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const accessibleLabel = open
    ? "Close search settings"
    : "Open search settings";

  return (
    <div className="settings-panel">
      <button
        className={`settings-panel__toggle${open ? " settings-panel__toggle--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-expanded={open}
        aria-label={accessibleLabel}
        title={accessibleLabel}
      >
        <FiSettings
          className="settings-panel__icon"
          aria-hidden="true"
          focusable="false"
        />
      </button>

      {open && (
        <div className="settings-panel__content">
          <DbControlPanel />
        </div>
      )}
    </div>
  );
}
