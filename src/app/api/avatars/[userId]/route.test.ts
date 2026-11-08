import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const findUnique = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { userAvatar: { findUnique } } }));

beforeEach(() => {
  findUnique.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), updatedAt: new Date(123) });
});

function get(etag?: string) {
  return GET(new Request("http://localhost/api/avatars/user?v=123", {
    headers: etag ? { "If-None-Match": etag } : {},
  }), { params: Promise.resolve({ userId: "user" }) });
}

describe("cache des avatars", () => {
  it.each(['"123"', 'W/"123"', '"old", "123"', "*"])("répond 304 pour %s", async (etag) => {
    const response = await get(etag);
    expect(response.status).toBe(304);
    expect(response.headers.get("ETag")).toBe('"123"');
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(await response.text()).toBe("");
  });

  it.each([undefined, '"old"'])("renvoie les octets sans correspondance : %s", async (etag) => {
    const response = await get(etag);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("répond 404 sans avatar même avec If-None-Match", async () => {
    findUnique.mockResolvedValue(null);
    expect((await get("*")).status).toBe(404);
  });
});
