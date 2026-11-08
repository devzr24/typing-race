import { afterEach, expect, it, vi } from "vitest";
import { roomStore } from "@/lib/rooms/prisma-store";
import { activeRaces } from "@/lib/rooms/race-memory";
import { createRaceState, raceSelf, raceSnapshot } from "@/lib/race/engine";
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

afterEach(async () => {
  await roomStore.withRoom("ABCDEF", async (_, locked) => locked.deleteRoom());
  activeRaces.clear();
  vi.restoreAllMocks();
});

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

it.each(["finished", "abandoned", "spectator"] as const)("renvoie la piste courante à room:watch pour %s", async (status) => {
  const identity = { key: "banned", displayName: "Player", image: null, isGuest: true };
  const room = await roomStore.createRoom("ABCDEF", identity, status === "spectator");
  await roomStore.withRoom("ABCDEF", async (_, locked) => locked.setStatus("EN_COURSE"));
  room.bots.push({ id: "bot", name: "Bot", level: "IMPOSSIBLE" });
  const state = createRaceState(room, "abc def", 1000, 42);
  if (status !== "spectator") state.racers[0].status = status;
  activeRaces.set(room.code, { text: state.text, startsAt: state.startsAt, state });
  vi.spyOn(Date, "now").mockReturnValue(2000);
  const on = vi.fn();
  registerRoomHandlers({ use: vi.fn(), on } as unknown as RealtimeServer);
  const socket = {
    data: { identity, watched: new Set<string>() },
    request: { headers: {} }, on: vi.fn(), join: vi.fn(),
  };
  on.mock.calls[0][1](socket);
  const watch = socket.on.mock.calls.find(([event]) => event === "room:watch")![1];
  const ack = vi.fn();
  await watch({ code: room.code }, ack);
  const response = ack.mock.calls[0][0];
  expect(response.ok).toBe(true);
  expect(response.raceSnapshot).toEqual(raceSnapshot(state, 2000));
  expect(response.self).toEqual(status === "spectator" ? undefined : raceSelf(state, room.participants[0].id));
  expect(response.raceSnapshot.racers[0]).not.toHaveProperty("text");
});
