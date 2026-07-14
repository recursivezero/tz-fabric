import { Suspense, lazy } from "react";
import Home from "./pages/Home";
import { Navigate, Route, Routes } from "react-router-dom";

const ImageDescription = lazy(() => import("./pages/ImageDescriptor"));
const UploadPage = lazy(() => import("./pages/AudioForm"));
const ContentGrid = lazy(() => import("./pages/FabricList"));
const Search = lazy(() => import("./pages/FabricSearch"));
const Chat = lazy(() => import("./pages/FabricChat"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const ContactUs = lazy(() =>
  import("./pages/Contact").then((module) => ({ default: module.ContactUs })),
);
const Reader = lazy(() => import("./pages/Reader"));
const CardReader = lazy(() => import("./pages/PanCardReader"));
const AadhaarCardReader = lazy(() => import("./pages/AadhaarCardReader"));
const NotFound = lazy(() =>
  import("./components/NotFound").then((module) => ({
    default: module.NotFound,
  })),
);

const RouteFallback = () => (
  <div className="route-loading" role="status" aria-live="polite">
    Loading…
  </div>
);

export const Routing = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
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
        <Route path="*" element={<NotFound />} />
        <Route path="/reader" element={<Reader />} />
        <Route path="/reader/pan" element={<CardReader />} />
        <Route path="/reader/aadhaar" element={<AadhaarCardReader />} />
        <Route
          path="/reader/adhaar"
          element={<Navigate to="/reader/aadhaar" replace />}
        />
      </Routes>
    </Suspense>
  );
};
