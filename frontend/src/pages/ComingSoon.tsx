import type React from "react";

import "@/assets/styles/ComingSoon.css";

const ComingSoon: React.FC = () => {
  return (
    <div className="container">
      <div className="badge">In Development</div>
      <h1>Refining Experience</h1>
      <p>This module is currently being optimized for production. We're applying the final touches to ensure a seamless experience.</p>
      <div className="loader">
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
      </div>
    </div>
  );
};

export default ComingSoon;
