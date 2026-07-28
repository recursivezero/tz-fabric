import { Route, Routes } from "react-router-dom";
import { NotFound } from "./components/NotFound";
import { usePageTracking } from "./hooks/usePageTracking";
import AadhaarCardReader from "./pages/AadhaarCardReader";
import UploadPage from "./pages/AudioForm";
import ComingSoon from "./pages/ComingSoon";
import { ContactUs } from "./pages/Contact";
import Chat from "./pages/FabricChat";
import ContentGrid from "./pages/FabricList";
import Search from "./pages/FabricSearch";
import Home from "./pages/Home";
import ImageDescription from "./pages/ImageDescriptor";
import CardReader from "./pages/PanCardReader";
import Reader from "./pages/Reader";
import LanceDBExplorer from "./pages/admin/LanceDBExplorer";

export const Routing = () => {
  usePageTracking();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/analysis" element={<ImageDescription />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/view" element={<ContentGrid />} />
      <Route path="/search" element={<Search />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/features" element={<ComingSoon />} />
      <Route path="/pricing" element={<ComingSoon />} />
      <Route path="/api" element={<ComingSoon />} />
      <Route path="/docs" element={<ComingSoon />} />
      <Route path="/help" element={<ComingSoon />} />
      <Route path="/contact" element={<ContactUs />} />
      <Route path="/reader" element={<Reader />} />
      <Route path="/reader/pan" element={<CardReader />} />
      <Route path="/reader/adhaar" element={<AadhaarCardReader />} />
      <Route path="/admin/lancedb" element={<LanceDBExplorer />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};