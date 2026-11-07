import { expect, it, vi } from "vitest";
import { roomStore } from "@/lib/rooms/prisma-store";
import { registerRoomHandlers } from "./room-socket";
import type { RealtimeServer } from "./realtime";

vi.mock("@/lib/rooms/prisma-store", async () => {
  const { MemoryRoomStore } = await import("@/lib/rooms/memory-store");
  return { roomStore: Object.assign(new MemoryRoomStore(), {
    resetInterruptedRaces: async () => {}, listMemberships: async () => [],
  }) };
});
vi.mock("./socket-identity", () => ({
  identityFromCookieHeader: async () => ({ key: "banned", displayName: "Player", image: null, isGuest: true }),
}));

it("refuse room:watch à un socket dont la clé est bannie sans rejoindre le canal", async () => {
  const identity = { key: "banned", displayName: "Player", image: null, isGuest: true };
  await roomStore.createRoom("ABCDEF", identity, false);
  await roomStore.withRoom("ABCDEF", async (_, locked) => locked.ban(identity.key));
  const on = vi.fn();
  registerRoomHandlers({ use: vi.fn(), on } as unknown as RealtimeServer);
  const socket = {
    data: { identity, watched: new Set<string>() },
    request: { headers: {} }, on: vi.fn(), join: vi.fn(),
  };
  on.mock.calls[0][1](socket);
  const watch = socket.on.mock.calls.find(([event]) => event === "room:watch")![1];
  const ack = vi.fn();
  await watch({ code: "ABCDEF" }, ack);
  expect(ack).toHaveBeenCalledExactlyOnceWith({ ok: false, error: "roomBanned" });
  expect(socket.join).not.toHaveBeenCalled();
  expect(socket.data.watched.size).toBe(0);
});
