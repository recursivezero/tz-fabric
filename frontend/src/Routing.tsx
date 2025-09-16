import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import UploadPage from "./pages/AudioForm";
import ContentGrid from "./pages/FabricList";
import Search from "./pages/FabricSearch";
import Home from "./pages/Home";
import ImageDescription from "./pages/ImageDescriptor";

export const Routing = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/describe" element={<ImageDescription />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/view" element={<ContentGrid />} />
        <Route path="/search" element={<Search />} />
      </Routes>
    </Router>
  );
};
