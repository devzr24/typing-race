import { beforeEach, describe, expect, it, vi } from "vitest";
import { authRateLimiter } from "@/lib/auth/rate-limit";
import { MemoryRoomStore } from "./memory-store";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "player", username: "Player", image: null, isGuest: true } })) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "forged, test-actions-ip" }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./prisma-store", async () => {
  const { MemoryRoomStore } = await import("./memory-store");
  return { roomStore: new MemoryRoomStore() };
});
vi.mock("@/server/realtime", () => ({ connectedRoomKeys: async () => new Set(), publishRoom: vi.fn(), publishDeparture: vi.fn() }));

import { auth } from "@/auth";
import { joinRoomAction } from "./actions";
import { roomStore } from "./prisma-store";

beforeEach(() => {
  vi.clearAllMocks();
  authRateLimiter.reset("room:code:ip:test-actions-ip");
});

describe("entrée par code limitée avant toute lecture", () => {
  it("compte les codes invalides et refuse la onzième tentative avant auth ou le stockage", async () => {
    const membership = vi.spyOn(roomStore, "findMembership");
    const withRoom = vi.spyOn(roomStore, "withRoom");
    const data = new FormData();
    data.set("code", "invalid");
    for (let i = 0; i < 10; i++) expect((await joinRoomAction({}, data)).error).toBe("roomCodeInvalid");
    data.set("code", "ABCDEF");
    expect(await joinRoomAction({}, data)).toEqual({ error: "tooManyAttempts", values: { code: "ABCDEF" } });
    expect(auth).toHaveBeenCalledTimes(10);
    expect(membership).not.toHaveBeenCalled();
    expect(withRoom).not.toHaveBeenCalled();
  });

  it("compte aussi les codes inexistants", async () => {
    expect(roomStore).toBeInstanceOf(MemoryRoomStore);
    const data = new FormData();
    data.set("code", "ABCDEF");
    for (let i = 0; i < 10; i++) expect((await joinRoomAction({}, data)).error).toBe("roomNotFound");
    expect((await joinRoomAction({}, data)).error).toBe("tooManyAttempts");
  });
});
