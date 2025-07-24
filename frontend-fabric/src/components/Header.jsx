import "../styles/Header.css";

const Header = ({ showBack, onBack }) => {
  return (
    <div className="header-wrapper">
      <div className="animated-header">
        <h1>AI Fabric Search</h1>
      </div>
    </div>
  );
};

export default Header;
