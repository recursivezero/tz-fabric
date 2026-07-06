import "@/assets/styles/DrawerToggle.css";

const DrawerToggle = ({ showDrawer, setShowDrawer }) => {
  return (
    <div
      className="drawer-toggle-wrapper"
      style={{ right: showDrawer ? "250px" : "0px" }}
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
