import type { Dispatch, SetStateAction } from "react";
import "@/assets/styles/DrawerToggle.css";

type DrawerToggleProps = {
  showDrawer: boolean;
  setShowDrawer: Dispatch<SetStateAction<boolean>>;
};

const DrawerToggle = ({ showDrawer, setShowDrawer }: DrawerToggleProps) => {
  return (
    <div
      className="drawer-toggle-wrapper"
      style={{ right: showDrawer ? "clamp(248px, 19vw, 272px)" : "0px" }}
    >
      <button
        type="button"
        className="drawer-toggle-button"
        onClick={() => setShowDrawer(!showDrawer)}
        aria-label={showDrawer ? "Collapse sample image drawer" : "Expand sample image drawer"}
        title={showDrawer ? "Collapse samples" : "Expand samples"}
      >
        <span aria-hidden="true">{showDrawer ? "❯" : "❮"}</span>
      </button>
    </div>
  );
};

export default DrawerToggle;
