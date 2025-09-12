import "../styles/DrawerToggle.css";

const DrawerToggle = ({ showDrawer, setShowDrawer }) => {
  return (
    <div className="drawer-toggle-wrapper" style={{ right: showDrawer ? "250px" : "0px" }}>
      <button type="button" className="drawer-toggle-button" onClick={() => setShowDrawer(!showDrawer)}>
        {showDrawer ? ">" : "<"}
      </button>
    </div>
  );
};

export default DrawerToggle;
