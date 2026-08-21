import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/utils/http";
import {
  buildLanceRowsUrl,
  isAdminAccessError,
  scanLanceTables,
  verifyLanceAdminAccess,
} from "./lancedbAdmin";

type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const localSource = {
  storage: "local" as const,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LanceDB administrator API", () => {
  it("validates administrator access without reading LanceDB tables", async () => {
    const fetchMock = vi.fn<FetchFunction>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          authenticated: true,
          auth_mode: "internal-secret-header",
          header_name: "X-Internal-Secret",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await verifyLanceAdminAccess("private-secret");

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/lancedb/access");
    const headers = new Headers(requestInit?.headers);
    expect(headers.get("X-Internal-Secret")).toBe("private-secret");
    expect(headers.get("X-LanceDB-Location")).toBeNull();
  });

  it("sends the selected source only when scanning tables", async () => {
    const fetchMock = vi.fn<FetchFunction>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ source: localSource, tables: [{ name: "fabric" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(scanLanceTables(localSource, "private-secret")).resolves.toEqual({
      source: localSource,
      tables: [{ name: "fabric" }],
    });

    const [url, requestInit] = fetchMock.mock.calls[0];
    const headers = new Headers(requestInit?.headers);
    expect(String(url)).toContain("/admin/lancedb/scan");
    expect(String(url)).not.toContain("private-secret");
    expect(headers.get("X-Internal-Secret")).toBe("private-secret");
    expect(headers.get("X-LanceDB-Storage")).toBe("local");
    expect(headers.get("X-LanceDB-Location")).toBeNull();
    expect(requestInit?.cache).toBe("no-store");
  });

  it("never sends a client filesystem location for local scans", async () => {
    const fetchMock = vi.fn<FetchFunction>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ source: localSource, tables: [] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await scanLanceTables(
      { storage: "local", location: "unexpected-client-path" },
      "private-secret",
    );

    const [, requestInit] = fetchMock.mock.calls[0];
    const headers = new Headers(requestInit?.headers);
    expect(headers.get("X-LanceDB-Storage")).toBe("local");
    expect(headers.get("X-LanceDB-Location")).toBeNull();
  });

  it("sends an explicit R2 database URI without sending credentials", async () => {
    const source = {
      storage: "r2" as const,
      location: "s3://example-r2-bucket/lancedb",
    };
    const fetchMock = vi.fn<FetchFunction>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ source, tables: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await scanLanceTables(source, "private-secret");

    const [, requestInit] = fetchMock.mock.calls[0];
    const headers = new Headers(requestInit?.headers);
    expect(headers.get("X-LanceDB-Storage")).toBe("r2");
    expect(headers.get("X-LanceDB-Location")).toBe(source.location);
    expect(JSON.stringify(requestInit)).not.toContain("R2_SECRET_ACCESS_KEY");
  });

  it("builds a server-pagination URL with encoded table and exact tag filter", () => {
    const url = buildLanceRowsUrl("fabric/table", {
      page: 3,
      pageSize: 50,
      tag: " kid's wear ",
      sortBy: "mtime",
      sortOrder: "desc",
    });

    expect(url).toContain("fabric%2Ftable/rows?");
    expect(url).toContain("page=3");
    expect(url).toContain("page_size=50");
    expect(url).toContain("tag=kid%27s+wear");
    expect(url).toContain("sort_by=mtime");
    expect(url).toContain("sort_order=desc");
  });

  it("maps network failures to a stable administrator message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("raw"))),
    );

    await expect(scanLanceTables(localSource, "private-secret")).rejects.toThrow(
      "LanceDB could not be reached. Try refreshing.",
    );
  });

  it("recognises only HTTP 403 as rejected administrator access", () => {
    expect(isAdminAccessError(new HttpError(403, "Rejected"))).toBe(true);
    expect(isAdminAccessError(new HttpError(404, "Missing"))).toBe(false);
    expect(isAdminAccessError(new HttpError(503, "Unavailable"))).toBe(false);
    expect(isAdminAccessError(new Error("Rejected"))).toBe(false);
  });
});
