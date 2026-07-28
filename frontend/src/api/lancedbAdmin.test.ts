import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLanceRowsUrl,
  fetchLanceTables,
  isAdminAccessError,
} from "./lancedbAdmin";
import { HttpError } from "@/utils/http";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LanceDB administrator API", () => {
  it("sends the private secret as a header and never as a query parameter", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ tables: [{ name: "tz-fabric-table" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLanceTables("private-secret")).resolves.toEqual({
      tables: [{ name: "tz-fabric-table" }],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("private-secret");
    expect(new Headers(init?.headers).get("X-Internal-Secret")).toBe(
      "private-secret",
    );
    expect(init?.cache).toBe("no-store");
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
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("raw"))));

    await expect(fetchLanceTables("private-secret")).rejects.toThrow(
      "LanceDB could not be reached. Try refreshing.",
    );
  });

  it("recognises only HTTP 403 as rejected administrator access", () => {
    expect(isAdminAccessError(new HttpError(403, "Rejected"))).toBe(true);
    expect(isAdminAccessError(new HttpError(404, "Missing"))).toBe(false);
    expect(isAdminAccessError(new Error("Rejected"))).toBe(false);
  });
});
