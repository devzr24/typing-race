import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRoomStore } from "@/lib/rooms/memory-store";
import { activeRaces, clearRace, type ActiveRace } from "@/lib/rooms/race-memory";
import { executeHostCommand, joinRoom, leaveRoom, toPublicRoom } from "@/lib/rooms/service";
import * as roomService from "@/lib/rooms/service";
import type { Identity } from "@/lib/rooms/types";
import { roomStore } from "@/lib/rooms/prisma-store";
import { setRaceTransport, startRaceRuntime } from "./race-runtime";
import { registerRoomHandlers } from "./room-socket";
import type { RealtimeServer } from "./realtime";
import * as realtime from "./realtime";
import { identityFromCookieHeader } from "./socket-identity";
import { persistRace } from "@/lib/race/persist";

vi.mock("@/lib/race/persist", () => ({ persistRace: vi.fn() }));

vi.mock("@/lib/rooms/prisma-store", async () => {
  const { MemoryRoomStore } = await import("@/lib/rooms/memory-store");
  return { roomStore: Object.assign(new MemoryRoomStore(), {
    resetInterruptedRaces: async () => {}, listMemberships: async () => [],
  }) };
});
vi.mock("./socket-identity", () => ({
  identityFromCookieHeader: vi.fn(async (cookie: string) => cookie === "expired" ? null : ({ key: cookie, displayName: cookie, image: null, isGuest: false })),
}));

const host: Identity = { key: "host", displayName: "Host", image: null, isGuest: false };
const guest: Identity = { ...host, key: "guest", displayName: "Guest" };
const code = "ABCDEF";
const send = vi.fn();
const self = vi.fn();
const publish = vi.fn(async () => {});
const store = roomStore as unknown as MemoryRoomStore;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  vi.clearAllMocks();
  vi.mocked(persistRace).mockReset().mockResolvedValue(null);
  store.rooms.clear();
  await store.createRoom(code, host);
  await joinRoom(store, code, guest);
  store.rooms.get(code)!.config.bonusesEnabled = false;
  setRaceTransport({ room: send, self });
});
afterEach(() => {
  for (const key of activeRaces.keys()) clearRace(key);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function start(text = "a".repeat(200)) {
  await executeHostCommand(store, code, host, { type: "start" }, publish, async () => ({ ok: true, text }));
  await vi.advanceTimersByTimeAsync(3000);
  return activeRaces.get(code)!;
}

function sockets() {
  const connected = new Set<ReturnType<typeof connect>>();
  const on = vi.fn();
  const io = {
    use: vi.fn(), on,
    in: (channel: string) => ({ fetchSockets: async () => [...connected].filter((s) => s.rooms.has(channel)) }),
  };
  registerRoomHandlers(io as unknown as RealtimeServer);
  vi.spyOn(realtime, "connectedRoomKeys").mockImplementation(async (roomCode) => new Set(
    [...connected].filter((s) => s.rooms.has(realtime.roomChannel(roomCode))).map((s) => s.data.identity.key),
  ));
  function connect(identity: Identity) {
    const rooms = new Set<string>();
    const socket = {
      data: { identity, watched: new Set<string>() }, request: { headers: { cookie: identity.key } },
      on: vi.fn(), rooms, join: vi.fn(async (channel: string) => { rooms.add(channel); }),
    };
    on.mock.calls.find(([event]) => event === "connection")![1](socket);
    return socket;
  }
  async function watch(socket: ReturnType<typeof connect>) {
    connected.add(socket);
    const ack = vi.fn();
    await socket.on.mock.calls.find(([event]) => event === "room:watch")![1]({ code }, ack);
    return ack.mock.calls[0][0];
  }
  async function disconnect(socket: ReturnType<typeof connect>) {
    connected.delete(socket);
    await socket.on.mock.calls.find(([event]) => event === "disconnect")![1]();
  }
  async function input(socket: ReturnType<typeof connect>, seq: number, keys = "a") {
    const ack = vi.fn();
    await socket.on.mock.calls.find(([event]) => event === "race:input")![1]({ code, seq, keys }, ack);
    return ack.mock.calls[0][0];
  }
  return { connect, watch, disconnect, input };
}

describe("minuteries de course", () => {
  it("persiste une seule fois après la fin puis diffuse l'id et le record sans clé de session", async () => {
    const race = await start("ab");
    vi.mocked(persistRace).mockResolvedValueOnce({ id: "saved-race", personalBests: [true, false] });
    expect(persistRace).not.toHaveBeenCalled();
    race.runtime!.input(race.state!.racers[0].id, "a");
    expect(persistRace).not.toHaveBeenCalled();
    race.runtime!.input(race.state!.racers[0].id, "b");
    race.runtime!.abandon(race.state!.racers[1].id);
    await vi.advanceTimersByTimeAsync(0);
    expect(persistRace).toHaveBeenCalledOnce();
    expect((await store.findRoom(code))!.status).toBe("RESULTATS");
    expect(race.results![0]).toMatchObject({ raceId: "saved-race", isPersonalBest: true });
    expect(toPublicRoom((await store.findRoom(code))!).results).toEqual(race.results);
    const results = send.mock.calls.filter(([, event]) => event === "race:results");
    expect(results).toHaveLength(1);
    expect(results[0][2]).toEqual(race.results);
    expect(JSON.stringify(results[0][2])).not.toContain('"key"');
    race.runtime!.abandon(race.state!.racers[0].id);
    await vi.advanceTimersByTimeAsync(1000);
    expect(persistRace).toHaveBeenCalledOnce();
  });
  it("journalise l'échec de persistance et diffuse quand même les résultats", async () => {
    const race = await start("a");
    const failure = new Error("storage unavailable");
    vi.mocked(persistRace).mockRejectedValueOnce(failure);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    race.runtime!.abandon(race.state!.racers[0].id);
    race.runtime!.abandon(race.state!.racers[1].id);
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toHaveBeenCalledWith("> race persist", failure);
    expect((await store.findRoom(code))!.status).toBe("RESULTATS");
    expect(send.mock.calls.filter(([, event]) => event === "race:results")).toHaveLength(1);
    expect(race.results!.every((r) => !r.raceId && !r.isPersonalBest)).toBe(true);
  });
  it.each(["départ", "expulsion"])("termine sans temps maximal après le %s du second humain", async (departure) => {
    const race = await start("a");
    const [first, second] = race.state!.racers;
    if (departure === "départ") expect(await leaveRoom(store, code, guest.key)).toBe("left");
    else expect(await executeHostCommand(store, code, host, { type: "kick", id: second.id })).toEqual({ ok: true, kickedKey: guest.key });
    expect(second.status).toBe("abandoned");
    expect((await store.findRoom(code))!.participants.map((p) => p.key)).toEqual([host.key]);
    const clients = sockets();
    expect(await clients.input(clients.connect(guest), 0)).toEqual({ ok: false, error: "raceNotRacing" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(race.runtime!.input(first.id, "a").ok).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect((await store.findRoom(code))!.status).toBe("RESULTATS");
    expect(race.results!.map((r) => r.status)).toEqual(["finished", "abandoned"]);
  });
  it("réessaie la finalisation après un refus du service", async () => {
    store.rooms.get(code)!.config.timeLimitSec = 30;
    const race = await start("a");
    const finish = vi.spyOn(roomService, "finishRace").mockResolvedValueOnce({ ok: false, error: "roomNotWaiting" });
    race.runtime!.abandon(race.state!.racers[0].id);
    race.runtime!.abandon(race.state!.racers[1].id);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(finish).toHaveBeenCalledTimes(2);
    expect((await store.findRoom(code))!.status).toBe("RESULTATS");
  });
  it("les bots seuls terminent et passent en RESULTATS sans temps maximal", async () => {
    const room = store.rooms.get(code)!;
    room.participants.forEach((p) => { p.isSpectator = true; });
    room.bots = [{ id: "bot1", name: "First", level: "EXPERT" }, { id: "bot2", name: "Second", level: "IMPOSSIBLE" }];
    room.status = "EN_COURSE";
    // La garde de lancement reste inchangée : ce scénario exerce directement le runtime.
    const race: ActiveRace = { text: "a short race", startsAt: Date.now(), seed: 42 };
    activeRaces.set(code, race);
    startRaceRuntime(store, structuredClone(room), race, publish);
    await vi.advanceTimersByTimeAsync(20_000);
    expect((await store.findRoom(code))!.status).toBe("RESULTATS");
    expect(race.results).toHaveLength(2);
    expect(race.results!.every((r) => r.status === "finished")).toBe(true);
    expect(send.mock.calls.filter(([, event]) => event === "race:results")).toHaveLength(1);
    expect(toPublicRoom((await store.findRoom(code))!).results).toEqual(race.results);
    expect(vi.getTimerCount()).toBe(0);
    await executeHostCommand(store, code, host, { type: "reset" });
    expect(activeRaces.has(code)).toBe(false);
  });
  it("diffuse au plus dix états par seconde et aucun doublon sans changement", async () => {
    const race = await start();
    const id = race.state!.racers[0].id;
    for (let i = 0; i < 100; i++) {
      race.runtime!.input(id, "x"); // Erreurs en correction : position et MPM inchangés.
      await vi.advanceTimersByTimeAsync(10);
    }
    const states = send.mock.calls.filter(([, event]) => event === "race:state");
    expect(states).toHaveLength(1);
    expect(JSON.stringify(states)).not.toContain('"key"');
    send.mockClear();
    for (let i = 0; i < 100; i++) {
      race.runtime!.input(id, "a");
      await vi.advanceTimersByTimeAsync(10);
    }
    const changed = send.mock.calls.filter(([, event]) => event === "race:state");
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < changed.length; i++) expect(changed[i][2].serverNow - changed[i - 1][2].serverNow).toBeGreaterThanOrEqual(100);
  });
  it("expire les actifs au temps maximal et conserve les résultats", async () => {
    store.rooms.get(code)!.config.timeLimitSec = 30;
    const race = await start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await store.findRoom(code))!.status).toBe("RESULTATS");
    expect(race.results!.map((r) => r.status)).toEqual(["timeout", "timeout"]);
    expect(race.runtime!.input(race.state!.racers[0].id, "a")).toEqual({ ok: false, error: "raceNotRacing" });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("force la fin à la minuterie même si l'horloge est juste avant la limite", async () => {
    store.rooms.get(code)!.config.timeLimitSec = 30;
    const race = await start();
    vi.spyOn(Date, "now").mockReturnValue(race.startsAt + 29_999);
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await store.findRoom(code))!.status).toBe("RESULTATS");
    expect(race.results!.map((r) => [r.status, r.elapsedMs])).toEqual([["timeout", 30_000], ["timeout", 30_000]]);
  });
  it("diffuse le bonus et le texte modifié seulement au coureur ciblé, puis le restitue à la reprise", async () => {
    store.rooms.get(code)!.config.bonusesEnabled = true;
    const race = await start(Array.from({ length: 40 }, (_, i) => `word${i}`).join(" "));
    race.state!.seed = 0; // Premier bonus : plus3 pour le meneur.
    const leader = race.state!.racers[0];
    self.mockClear();
    vi.setSystemTime(race.startsAt + 60_000);
    while (leader.position <= race.text.length / 4) {
      race.runtime!.input(leader.id, leader.text.slice(leader.position, leader.position + 20));
    }
    expect(send.mock.calls.filter(([, event]) => event === "race:bonus")).toEqual([
      [code, "race:bonus", { type: "plus3", playerId: race.state!.racers[1].id, targetId: leader.id, checkpoint: 0.25 }],
    ]);
    expect(self).toHaveBeenCalledTimes(1);
    expect(self.mock.calls[0].slice(0, 2)).toEqual([code, leader.id]);
    expect(self.mock.calls[0][2].text).toBe(leader.text);
    expect(leader.text.split(" ")).toHaveLength(43);
    const clients = sockets();
    const response = await clients.watch(clients.connect(host));
    expect(response.self).toEqual({ text: leader.text, position: leader.position, errors: 0, fogUntil: 0 });
  });
  it("annule toutes les minuteries à la fermeture", async () => {
    const room = store.rooms.get(code)!;
    room.bots.push({ id: "bot", name: "Bot", level: "NOOB" });
    await start();
    await executeHostCommand(store, code, host, { type: "close" });
    send.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("frappes et déconnexion Socket.IO", () => {
  it("retire l'hôte après 30 s, transfère son rôle et conserve son résultat", async () => {
    const race = await start("a".repeat(20));
    const clients = sockets();
    const socket = clients.connect(host);
    await clients.watch(socket);
    await clients.watch(clients.connect(guest));
    const published = vi.spyOn(realtime, "publishRoom");
    await clients.input(socket, 0, "aaa");
    await clients.disconnect(socket);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(race.state!.racers[0].status).toBe("racing");
    await vi.advanceTimersByTimeAsync(1);
    expect(race.state!.racers[0]).toMatchObject({ status: "abandoned", position: 3, abandonedProgress: 0.15 });
    expect((await store.findRoom(code))!.participants.map((p) => p.key)).toEqual([guest.key]);
    expect((await store.findRoom(code))!.hostKey).toBe(guest.key);
    expect(published).toHaveBeenCalledWith(code);
    expect(race.runtime!.input(race.state!.racers[1].id, race.text).ok).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect((await store.findRoom(code))!.status).toBe("RESULTATS");
    expect(race.results!.find((r) => r.id === race.state!.racers[0].id)!.status).toBe("abandoned");
    expect(await executeHostCommand(store, code, guest, { type: "reset" })).toEqual({ ok: true });
  });
  it("reprend avant 30 s avec le même texte, la position et les erreurs", async () => {
    const race = await start();
    const clients = sockets();
    const socket = clients.connect(host);
    await clients.watch(socket);
    await clients.input(socket, 0, "axa");
    await clients.disconnect(socket);
    await vi.advanceTimersByTimeAsync(20_000);
    const reconnected = clients.connect(host);
    const response = await clients.watch(reconnected);
    expect(response.self).toEqual({ text: race.text, position: 2, errors: 1, fogUntil: 0 });
    await vi.advanceTimersByTimeAsync(11_000);
    expect(race.state!.racers[0].status).toBe("racing");
    expect(await clients.input(reconnected, 0, "a")).toEqual({ ok: false, error: "raceSequenceInvalid" });
    expect(await clients.input(reconnected, 1, "a")).toEqual({ ok: true, position: 3, errors: 1 });
  });
  it("partage le débit et la séquence entre onglets, séparément pour chaque joueur", async () => {
    const race = await start();
    const clients = sockets();
    const socket = clients.connect(host);
    const second = clients.connect(host);
    await clients.watch(socket);
    expect(await clients.input(socket, 0)).toEqual({ ok: true, position: 1, errors: 0 });
    expect(await clients.input(second, 0)).toEqual({ ok: false, error: "raceSequenceInvalid" });
    for (let i = 1; i < 9; i++) expect((await clients.input(i % 2 ? socket : second, i)).ok).toBe(true);
    expect(await clients.input(second, 10)).toEqual({ ok: false, error: "raceTooFast" });
    expect(race.state!.racers[1].position).toBe(0);
    expect((await clients.input(clients.connect(guest), 0)).ok).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await clients.input(socket, 11)).ok).toBe(true);
  });
  it("refuse les spectateurs, les charges invalides et les sockets sans identité", async () => {
    await joinRoom(store, code, { ...host, key: "spectator" }, { isSpectator: true });
    await start();
    const clients = sockets();
    const spectator = clients.connect({ ...host, key: "spectator" });
    expect(await clients.input(spectator, 0)).toEqual({ ok: false, error: "raceNotRacing" });
    const socket = clients.connect(host);
    expect(await clients.input(socket, 0, "a".repeat(21))).toEqual({ ok: false, error: "raceInputInvalid" });
    Object.assign(socket.data, { identity: null });
    expect(await clients.input(socket, 1)).toEqual({ ok: false, error: "loginRequired" });
  });
  it("traite les frappes avec l'identité du handshake sans base ni relecture du cookie", async () => {
    await start();
    const clients = sockets();
    const socket = clients.connect(host);
    socket.request.headers.cookie = "expired";
    const transaction = vi.spyOn(store, "withRoom");
    vi.mocked(identityFromCookieHeader).mockClear();
    expect((await clients.input(socket, 0)).ok).toBe(true);
    expect(transaction).not.toHaveBeenCalled();
    expect(identityFromCookieHeader).not.toHaveBeenCalled();
    const ack = vi.fn();
    await socket.on.mock.calls.find(([event]) => event === "race:abandon")![1]({ code }, ack);
    expect(ack).toHaveBeenCalledWith({ ok: false, error: "loginRequired" });
  });
  it("un deuxième onglet connecté évite l'abandon", async () => {
    const race = await start();
    const clients = sockets();
    const first = clients.connect(host);
    const second = clients.connect(host);
    await clients.watch(first);
    await clients.watch(second);
    await clients.disconnect(first);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(race.state!.racers[0].status).toBe("racing");
  });
  it("applique l'abandon volontaire uniquement à l'identité du socket", async () => {
    const race = await start();
    const clients = sockets();
    const socket = clients.connect(host);
    const ack = vi.fn();
    await socket.on.mock.calls.find(([event]) => event === "race:abandon")![1]({ code }, ack);
    expect(ack).toHaveBeenCalledWith({ ok: true });
    expect(race.state!.racers.map((r) => r.status)).toEqual(["abandoned", "racing"]);
  });
});
