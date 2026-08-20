import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NAVBAR_MENU } from "@/constants";
import LanceAdminGate from "./LanceAdminGate";
import LanceMetadataPanel from "./LanceMetadataPanel";
import LancePagination from "./LancePagination";
import LanceRowGrid from "./LanceRowGrid";
import LanceSourceScanner from "./LanceSourceScanner";
import LanceScanToolbar from "./LanceScanToolbar";
import VectorViewer from "./VectorViewer";

const row = {
  row_id: 7,
  image_uri: "https://assets.threadzip.com/images/product/fabric.webp",
  tag: "product",
  hash: "0123456789abcdef",
  mtime: 1_785_177_296,
  vector: { length: 768, included: false as const },
};

describe("LanceDB Explorer components", () => {
  it("renders a password-based private administrator gate", () => {
    const html = renderToStaticMarkup(
      <LanceAdminGate loading={false} error={null} onUnlock={vi.fn()} />,
    );
    expect(html).toContain('type="password"');
    expect(html).toContain("Internal administrator secret");
    expect(html).toContain("INTERNAL_API_KEY");
    expect(html).not.toContain('placeholder="abcd1234"');
    expect(html).not.toContain("VITE_ADMIN_SECRET");
  });


  it("requires an explicit source scan after administrator login", () => {
    const html = renderToStaticMarkup(
      <LanceSourceScanner
        value={{ storage: "local", location: "" }}
        loading={false}
        error={null}
        onChange={vi.fn()}
        onScan={vi.fn()}
        onLock={vi.fn()}
      />,
    );

    expect(html).toContain("Choose storage and scan tables");
    expect(html).toContain("Scan tables");
    expect(html).not.toContain("Browse server");
    expect(html).toContain("Amazon S3");
    expect(html).toContain("Cloudflare R2");
    expect(html).toContain("Server folders and files are never exposed");
  });

  it("renders the R2 source without exposing credential inputs", () => {
    const html = renderToStaticMarkup(
      <LanceSourceScanner
        value={{ storage: "r2", location: "" }}
        loading={false}
        error={null}
        onChange={vi.fn()}
        onScan={vi.fn()}
        onLock={vi.fn()}
      />,
    );

    expect(html).toContain("R2 database URI (optional)");
    expect(html).toContain("R2_BUCKET_NAME");
    expect(html).not.toContain("R2_ACCESS_KEY_ID");
    expect(html).not.toContain("R2_SECRET_ACCESS_KEY");
  });

  it("keeps full vectors collapsed in the row grid", () => {
    const html = renderToStaticMarkup(
      <LanceRowGrid
        rows={[row]}
        loading={false}
        appliedTag=""
        onCopy={vi.fn()}
        onViewVector={vi.fn()}
        onClearFilter={vi.fn()}
      />,
    );
    expect(html).toContain("768 dimensions");
    expect(html).toContain("View vector");
    expect(html).not.toContain("0.123456");
  });

  it("disables previous and next controls from server pagination state", () => {
    const html = renderToStaticMarkup(
      <LancePagination
        loading={false}
        onPageChange={vi.fn()}
        pagination={{
          page: 1,
          page_size: 25,
          total_rows: 10,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        }}
      />,
    );
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });


  it("renders the scan toolbar and rescan controls", () => {
    const html = renderToStaticMarkup(
      <LanceScanToolbar
        source={{ storage: "s3", location: "s3://bucket/fabric" }}
        tables={[{ name: "tz-fabric-table" }]}
        selectedTable="tz-fabric-table"
        loading={false}
        refreshing={false}
        onSelect={vi.fn()}
        onRefresh={vi.fn()}
        onChangeSource={vi.fn()}
        onLock={vi.fn()}
      />,
    );
    expect(html).toContain("tz-fabric-table");
    expect(html).toContain("Rescan");
    expect(html).toContain("Change source");
    expect(html).toContain("s3://bucket/fabric");
    expect(html).toContain("Lock explorer");
  });

  it("renders embedding and vector metadata", () => {
    const html = renderToStaticMarkup(
      <LanceMetadataPanel
        metadata={{ owner: "threadzip" }}
        embeddingFunctions={[
          { name: "siglip", source_column: "image_uri", vector_column: "vector" },
        ]}
        vectorColumns={[{ name: "vector", dimension: 768 }]}
        loading={false}
      />,
    );
    expect(html).toContain("siglip");
    expect(html).toContain("image_uri");
    expect(html).toContain("768");
  });

  it("renders the exact-tag empty state and clear action", () => {
    const html = renderToStaticMarkup(
      <LanceRowGrid
        rows={[]}
        loading={false}
        appliedTag="product"
        onCopy={vi.fn()}
        onViewVector={vi.fn()}
        onClearFilter={vi.fn()}
      />,
    );
    expect(html).toContain("No rows match tag");
    expect(html).toContain("product");
    expect(html).toContain("Clear filter");
  });

  it("renders full vectors only in the explicit vector viewer", () => {
    const html = renderToStaticMarkup(
      <VectorViewer
        row={row}
        detail={{
          ...row,
          vector: { length: 3, values: [0.1, null, 0.3] },
        }}
        loading={false}
        error={null}
        returnFocusElement={null}
        onClose={vi.fn()}
        onCopy={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(html).toContain("Lazy row detail");
    expect(html).toContain("0.1");
    expect(html).toContain("Copy complete row");
  });

  it("does not expose the private admin route in public navigation", () => {
    expect(NAVBAR_MENU.some((item) => item.path.startsWith("/admin"))).toBe(false);
  });
});
