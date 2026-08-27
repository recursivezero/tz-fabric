import { Suspense, lazy, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";

type RouteModule = { default: ComponentType };
type RouteLoader = () => Promise<RouteModule>;

const ROUTE_IMPORT_RETRY_DELAY_MS = 250;

/**
 * Retry one transient route-module fetch before handing the error to the route
 * boundary. This keeps a temporary dev-server or network interruption from
 * immediately replacing the page with the fatal fallback.
 */
const loadRouteWithRetry = async (loader: RouteLoader): Promise<RouteModule> => {
  try {
    return await loader();
  } catch (firstError) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ROUTE_IMPORT_RETRY_DELAY_MS);
    });

    try {
      return await loader();
    } catch {
      throw firstError;
    }
  }
};

const lazyRoute = (loader: RouteLoader) =>
  lazy(() => loadRouteWithRetry(loader));

const ImageDescription = lazyRoute(() => import("./pages/ImageDescriptor"));
const UploadPage = lazyRoute(() => import("./pages/AudioForm"));
const ContentGrid = lazyRoute(() => import("./pages/FabricList"));
const Search = lazyRoute(() => import("./pages/FabricSearch"));
const Chat = lazyRoute(() => import("./pages/FabricChat"));
const ComingSoon = lazyRoute(() => import("./pages/ComingSoon"));
const ContactUs = lazyRoute(() =>
  import("./pages/Contact").then((module) => ({
    default: module.ContactUs,
  })),
);
const Reader = lazyRoute(() => import("./pages/Reader"));
const CardReader = lazyRoute(() => import("./pages/PanCardReader"));
const AadhaarCardReader = lazyRoute(() => import("./pages/AadhaarCardReader"));
const LanceDBExplorer = lazyRoute(
  () => import("./pages/admin/LanceDBExplorer"),
);
const NotFound = lazyRoute(() =>
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

        <Route path="/reader" element={<Reader />} />
        <Route path="/reader/pan" element={<CardReader />} />
        <Route path="/reader/aadhaar" element={<AadhaarCardReader />} />
        <Route
          path="/reader/adhaar"
          element={<Navigate to="/reader/aadhaar" replace />}
        />

        <Route path="/admin/lancedb" element={<LanceDBExplorer />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};