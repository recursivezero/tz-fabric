import { Routes, Route } from "react-router-dom";
import Search from "./pages/FabricSearch";
import UploadPage from "./pages/AudioForm";
import ContentGrid from "./pages/FabricList";
import Home from "./pages/Home";
import ImageDescription from "./pages/ImageDescriptor";
import Chat from "./pages/Chat";

export const Routing = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/describe" element={<ImageDescription />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/view" element={<ContentGrid />} />
      <Route path="/search" element={<Search />} />
      <Route path="/chat" element={<Chat />} />
    </Routes>
  );
};
