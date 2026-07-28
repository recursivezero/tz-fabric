import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "FabricAI";
const SITE_ORIGIN = "https://pro.threadzip.com";

type RouteMetadata = {
  title: string;
  description: string;
  robots?: "index,follow" | "noindex,nofollow";
};

const ROUTE_METADATA: Record<string, RouteMetadata> = {
  "/": {
    title: "FabricAI | Fabric Analysis and Search",
    description:
      "Analyze, search, upload, and discuss fabric images with FabricAI tools.",
  },
  "/analysis": {
    title: "Fabric Analyzer | FabricAI",
    description:
      "Run short or detailed AI-assisted analysis on a fabric image.",
  },
  "/upload": {
    title: "Upload Fabric Media | FabricAI",
    description:
      "Upload fabric images and optional audio notes for processing.",
  },
  "/view": {
    title: "Uploaded Fabrics | FabricAI",
    description: "Review previously uploaded fabric images and audio records.",
  },
  "/search": {
    title: "Fabric Search | FabricAI",
    description: "Search the fabric collection by text or reference image.",
  },
  "/chat": {
    title: "FabricAI Assistant",
    description: "Ask fabric questions and discuss image analysis results.",
  },
  "/reader": {
    title: "Document Reader | FabricAI",
    description: "Select a supported document type for structured extraction.",
  },
  "/reader/pan": {
    title: "PAN Card Reader | FabricAI",
    description: "Extract supported fields from a PAN card image.",
  },
  "/reader/aadhaar": {
    title: "Aadhaar Card Reader | FabricAI",
    description: "Extract supported fields from an Aadhaar card image.",
  },
  "/contact": {
    title: "Contact | FabricAI",
    description: "Contact the FabricAI team.",
  },
  "/admin/lancedb": {
    title: "LanceDB Explorer | FabricAI Admin",
    description: "Private read-only LanceDB inspection for administrators.",
    robots: "noindex,nofollow",
  },
};

const FALLBACK_METADATA: RouteMetadata = {
  title: SITE_NAME,
  description:
    "AI-assisted tools for fabric analysis, search, and documentation.",
};

function setMetaContent(selector: string, content: string) {
  const element = document.querySelector<HTMLMetaElement>(selector);
  if (element) element.content = content;
}

function resolveMetadata(pathname: string): RouteMetadata {
  return (
    ROUTE_METADATA[pathname] ??
    (pathname.startsWith("/reader/") ? ROUTE_METADATA["/reader"] : undefined) ??
    FALLBACK_METADATA
  );
}

export function useRouteMetadata() {
  const location = useLocation();

  useEffect(() => {
    const metadata = resolveMetadata(location.pathname);
    const canonicalUrl = new URL(location.pathname, SITE_ORIGIN).toString();

    document.title = metadata.title;
    setMetaContent('meta[name="description"]', metadata.description);
    setMetaContent('meta[name="title"]', metadata.title);
    setMetaContent('meta[property="og:title"]', metadata.title);
    setMetaContent('meta[property="og:description"]', metadata.description);
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[name="twitter:title"]', metadata.title);
    setMetaContent('meta[name="twitter:description"]', metadata.description);
    setMetaContent('meta[name="twitter:url"]', canonicalUrl);
    setMetaContent(
      'meta[name="robots"]',
      metadata.robots ?? "index,follow",
    );

    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (canonical) canonical.href = canonicalUrl;
  }, [location.pathname]);
}
