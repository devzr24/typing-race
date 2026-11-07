import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRoomStore } from "./memory-store";
import { activeRaces, clearRace } from "./race-memory";
import { executeHostCommand, finishRace, joinRoom, leaveRoom, toPublicRoom } from "./service";
import { raceConfigSchema, type HostCommand } from "./schemas";
import { defaultRaceConfig, type Identity } from "./types";

const host: Identity = { key: "host", displayName: "Host", image: null, isGuest: false };
const other: Identity = { key: "other", displayName: "Other", image: null, isGuest: true };
const code = "ABCDEF";
const loadText = vi.fn(async () => ({ ok: true as const, text: "texte de course" }));
const publish = vi.fn(async () => {});
let store: MemoryRoomStore;
const command = (input: HostCommand, identity: Identity | null = host) => executeHostCommand(store, code, identity, input, publish, loadText);

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  store = new MemoryRoomStore();
  await store.createRoom(code, host);
});
afterEach(() => {
  for (const key of activeRaces.keys()) clearRace(key);
  vi.useRealTimers();
});

describe("validation de la configuration", () => {
  it.each([null, 30, 600])("accepte le temps %s", (timeLimitSec) => {
    expect(raceConfigSchema.safeParse({ ...defaultRaceConfig, timeLimitSec }).success).toBe(true);
  });
  it.each([
    { timeLimitSec: 29 }, { timeLimitSec: 601 }, { timeLimitSec: 30.5 }, { timeLimitSec: "30" },
    { wordCount: 9 }, { wordCount: 201 }, { wordCount: 10.5 },
    { includeChars: "a".repeat(41) }, { excludeChars: "a".repeat(41) }, { includeChars: "a\u0000" },
    { textLanguage: "DE" }, { textType: "invalid" }, { complexity: "invalid" },
    { errorMode: "invalid" }, { bonusesEnabled: "true" }, { capacity: 30 },
  ])("refuse %j", (change) => {
    expect(raceConfigSchema.safeParse({ ...defaultRaceConfig, ...change }).success).toBe(false);
  });
  it("accepte les bornes des mots et caractères", () => {
    for (const wordCount of [10, 200]) {
      expect(raceConfigSchema.safeParse({ ...defaultRaceConfig, wordCount, includeChars: "a".repeat(40), excludeChars: "b".repeat(40) }).success).toBe(true);
    }
  });
});

describe("autorisation des actions de l'hôte", () => {
  const commands: HostCommand[] = [
    { type: "configure", config: defaultRaceConfig }, { type: "addBot", level: "EXPERT" },
    { type: "removeBot", id: "bot" }, { type: "start" }, { type: "reset" }, { type: "close" },
  ];
  it.each(commands)("refuse $type sans session ou sans être l'hôte courant", async (input) => {
    await joinRoom(store, code, other);
    const before = await store.findRoom(code);
    expect(await command(input, null)).toEqual({ ok: false, error: "loginRequired" });
    expect(await command(input, other)).toEqual({ ok: false, error: "roomHostOnly" });
    expect(await store.findRoom(code)).toEqual(before);
    expect(publish).not.toHaveBeenCalled();
  });
  it("accepte le nouvel hôte, refuse l'ancien", async () => {
    await joinRoom(store, code, other);
    await leaveRoom(store, code, host.key);
    expect(await command({ type: "addBot", level: "EXPERT" })).toEqual({ ok: false, error: "roomHostOnly" });
    expect(await command({ type: "addBot", level: "EXPERT" }, other)).toEqual({ ok: true });
  });
  it.each(["DECOMPTE", "EN_COURSE", "FERMEE"] as const)("verrouille la configuration et les bots en %s", async (status) => {
    store.rooms.get(code)!.status = status;
    for (const input of commands.slice(0, 3)) {
      expect(await command(input)).toEqual({ ok: false, error: "roomConfigLocked" });
    }
  });
  it.each(["EN_ATTENTE", "RESULTATS"] as const)("configure et gère les bots en %s", async (status) => {
    store.rooms.get(code)!.status = status;
    const config = { ...defaultRaceConfig, wordCount: 100, timeLimitSec: 60, textLanguage: "EN" as const };
    expect(await command({ type: "configure", config })).toEqual({ ok: true });
    expect(await command({ type: "addBot", level: "EXPERT" })).toEqual({ ok: true });
    const room = toPublicRoom((await store.findRoom(code))!);
    expect(room.config).toEqual(config);
    expect(room.bots[0]).toMatchObject({ level: "EXPERT", name: expect.stringMatching(/^Bot-\d+$/) });
    expect(await command({ type: "removeBot", id: room.bots[0].id })).toEqual({ ok: true });
    expect((await store.findRoom(code))!.bots).toEqual([]);
    expect(publish).toHaveBeenCalledTimes(3);
  });
  it("refuse une configuration invalide avant de la persister", async () => {
    expect(await executeHostCommand(store, code, host, { type: "configure", config: { ...defaultRaceConfig, wordCount: 201 } })).toEqual({ ok: false, error: "roomConfigInvalid" });
    expect((await store.findRoom(code))!.config).toEqual(defaultRaceConfig);
  });
});

describe("capacité et garde de lancement", () => {
  it("refuse un humain seul sans générer de texte", async () => {
    expect(await command({ type: "start" })).toEqual({ ok: false, error: "raceNeedsParticipants" });
    expect(loadText).not.toHaveBeenCalled();
    expect(toPublicRoom((await store.findRoom(code))!).race).toBeNull();
  });
  it("exclut les spectateurs et refuse une course de bots seuls", async () => {
    store.rooms.get(code)!.participants[0].isSpectator = true;
    await command({ type: "addBot", level: "NOOB" });
    await command({ type: "addBot", level: "IMPOSSIBLE" });
    expect(await command({ type: "start" })).toEqual({ ok: false, error: "raceNeedsHuman" });
    await joinRoom(store, code, other);
    expect(await command({ type: "start" })).toEqual({ ok: true });
  });
  it("compte les bots dans la capacité mais pas les spectateurs", async () => {
    store.rooms.get(code)!.capacity = 2;
    store.rooms.get(code)!.participants[0].isSpectator = true;
    expect(await command({ type: "addBot", level: "NOOB" })).toEqual({ ok: true });
    expect(await joinRoom(store, code, other)).toEqual({ ok: true, code });
    expect(await command({ type: "addBot", level: "NOOB" })).toEqual({ ok: false, error: "roomFull" });
    expect(await joinRoom(store, code, { ...other, key: "third" })).toEqual({ ok: false, error: "roomFull" });
  });
});

describe("cycle de course et minuteries serveur", () => {
  it.each(["NOT_ENOUGH_WORDS", "NO_PASSAGE"] as const)("reste en attente si la génération échoue : %s", async (reason) => {
    await command({ type: "addBot", level: "NOOB" });
    expect(await executeHostCommand(store, code, host, { type: "start" }, publish, async () => ({ ok: false, reason }))).toEqual({ ok: false, error: reason === "NO_PASSAGE" ? "raceNoPassage" : "raceNotEnoughWords" });
    expect((await store.findRoom(code))!.status).toBe("EN_ATTENTE");
    expect(activeRaces.has(code)).toBe(false);
  });
  it("révèle le texte au décompte, démarre après 3 s, termine à la limite puis relance", async () => {
    await command({ type: "addBot", level: "BEGINNER" });
    await command({ type: "configure", config: { ...defaultRaceConfig, timeLimitSec: 30 } });
    const now = Date.now();
    expect(await command({ type: "start" })).toEqual({ ok: true });
    const room = toPublicRoom((await store.findRoom(code))!);
    expect(room.status).toBe("DECOMPTE");
    expect(room.race).toEqual({ text: "texte de course", startsAt: now + 3000 });
    expect(loadText).toHaveBeenCalledWith({ ...defaultRaceConfig, timeLimitSec: 30 }, expect.any(Number));
    expect(await command({ type: "start" })).toEqual({ ok: false, error: "roomInvalidTransition" });
    await vi.advanceTimersByTimeAsync(2999);
    expect((await store.findRoom(code))!.status).toBe("DECOMPTE");
    await vi.advanceTimersByTimeAsync(1);
    expect((await store.findRoom(code))!.status).toBe("EN_COURSE");
    await vi.advanceTimersByTimeAsync(29999);
    expect((await store.findRoom(code))!.status).toBe("EN_COURSE");
    await vi.advanceTimersByTimeAsync(1);
    expect((await store.findRoom(code))!.status).toBe("RESULTATS");
    expect(await command({ type: "reset" })).toEqual({ ok: true });
    expect(toPublicRoom((await store.findRoom(code))!).race).toBeNull();
    expect((await store.findRoom(code))!.bots).toHaveLength(1);
    expect((await store.findRoom(code))!.config.timeLimitSec).toBe(30);
  });
  it("sans limite, attend finishRace et refuse une fin hors course", async () => {
    await joinRoom(store, code, other);
    expect(await finishRace(store, code)).toEqual({ ok: false, error: "roomInvalidTransition" });
    await command({ type: "start" });
    await vi.advanceTimersByTimeAsync(603000);
    expect((await store.findRoom(code))!.status).toBe("EN_COURSE");
    expect(await finishRace(store, code, publish)).toEqual({ ok: true });
    expect((await store.findRoom(code))!.status).toBe("RESULTATS");
  });
  it.each(["EN_ATTENTE", "DECOMPTE", "EN_COURSE", "RESULTATS"] as const)("ferme et supprime depuis %s", async (status) => {
    await command({ type: "addBot", level: "NOOB" });
    await command({ type: "start" });
    store.rooms.get(code)!.status = status;
    expect(await command({ type: "close" })).toEqual({ ok: true });
    expect(await store.findRoom(code)).toBeNull();
    expect(activeRaces.has(code)).toBe(false);
    await vi.advanceTimersByTimeAsync(100000);
    expect(await store.findRoom(code)).toBeNull();
  });
  it("supprime la salle et la minuterie au départ du dernier humain malgré les bots", async () => {
    await command({ type: "addBot", level: "NOOB" });
    await command({ type: "start" });
    expect(await leaveRoom(store, code, host.key)).toBe("room-closed");
    expect(await store.findRoom(code)).toBeNull();
    expect(activeRaces.has(code)).toBe(false);
  });
});
