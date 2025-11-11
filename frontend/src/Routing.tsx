import { Routes, Route } from "react-router-dom";
import Search from "./pages/FabricSearch";
import UploadPage from "./pages/AudioForm";
import ContentGrid from "./pages/FabricList";
import Home from "./pages/Home";
import ImageDescription from "./pages/ImageDescriptor";
import Chat from "./pages/FabricChat";
import ComingSoon from "./pages/ComingSoon";

export const Routing = () => {
  return (
    <Routes>
      <Route path="/" element={ <Home /> } />
      <Route path="/analysis" element={ <ImageDescription /> } />
      <Route path="/upload" element={ <UploadPage /> } />
      <Route path="/view" element={ <ContentGrid /> } />
      <Route path="/search" element={ <Search /> } />
      <Route path="/chat" element={ <Chat /> } />
      <Route path="/features" element={ <ComingSoon /> } />
      <Route path="/pricing" element={ <ComingSoon /> } />
      <Route path="/api" element={ <ComingSoon /> } />
      <Route path="/docs" element={ <ComingSoon /> } />
      <Route path="/contact" element={ <ComingSoon /> } />
      <Route path="/help" element={ <ComingSoon /> } />
    </Routes>
  );
};
