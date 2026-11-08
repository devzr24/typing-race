import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { defaultRaceConfig, type Room } from "@/lib/rooms/types";
import type { ActiveRace } from "@/lib/rooms/race-memory";
import { createRaceState, finalResults, timeoutRemaining } from "./engine";
import { persistRace, type RaceStorage } from "./persist";

function fixture(registered = true) {
  const room: Room = {
    code: "ABCDEF", status: "RESULTATS", hostKey: "user", createdAt: new Date(0), capacity: 8,
    visibility: "PUBLIQUE", invites: [], bannedKeys: [], config: { ...defaultRaceConfig },
    participants: [
      { id: "human", key: "user", displayName: "Human", image: null, isGuest: !registered, isSpectator: false, joinedAt: new Date(0) },
      { id: "guest", key: "guest-session", displayName: "Guest", image: null, isGuest: true, isSpectator: false, joinedAt: new Date(1) },
      { id: "spectator", key: "watcher", displayName: "Watcher", image: null, isGuest: false, isSpectator: true, joinedAt: new Date(2) },
    ],
    bots: [{ id: "bot", name: "Bot", level: "NOOB" }],
  };
  const state = createRaceState(room, "test", 1000, 0);
  state.racers[0].status = "finished";
  state.racers[0].correctKeystrokes = 250;
  state.racers[0].elapsedMs = state.racers[0].finishMs = 60_000;
  timeoutRemaining(state, 61_000);
  const race: ActiveRace = { text: state.text, startsAt: state.startsAt, state, results: finalResults(state) };
  return { room, race };
}

function storage(best: number | null = null) {
  const create = vi.fn<(args: Prisma.RaceCreateArgs) => Promise<{ id: string }>>(async () => ({ id: "saved-race" }));
  const groupBy = vi.fn<(args: Prisma.RaceResultGroupByArgs) => Promise<{ userId: string; _max: { wpm: number | null } }[]>>(async () => best === null ? [] : [{ userId: "user", _max: { wpm: best } }]);
  const tx = { race: { create } };
  const transaction = vi.fn(async (write: (tx: unknown) => Promise<unknown>) => write(tx));
  return { db: { raceResult: { groupBy }, $transaction: transaction } as unknown as RaceStorage, transaction, create, groupBy };
}

describe("persistance des résultats", () => {
  it("ne persiste pas une course sans inscrit coureur, même avec un spectateur inscrit", async () => {
    const { room, race } = fixture(false);
    const db = storage();
    expect(await persistRace(room, race, db.db)).toBeNull();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("enregistre tout le classement dans une seule écriture, sans userId pour invités et bots", async () => {
    const { room, race } = fixture();
    const db = storage(49);
    expect(await persistRace(room, race, db.db)).toEqual({ id: "saved-race", personalBests: [true, false, false] });
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(db.create).toHaveBeenCalledOnce();
    expect(db.create.mock.calls[0][0].data).toMatchObject({
      roomCode: room.code, text: "test", config: room.config, startedAt: new Date(1000), endedAt: new Date(61_000),
      results: { create: [
        { userId: "user", kind: "UTILISATEUR", rank: 1, wpm: 50, outcome: "TERMINE", isPersonalBest: true },
        { userId: null, kind: "INVITE", isPersonalBest: false },
        { userId: null, kind: "BOT", isPersonalBest: false },
      ] },
    });
    expect(db.groupBy).toHaveBeenCalledExactlyOnceWith({ by: ["userId"], where: { userId: { in: ["user"] }, outcome: "TERMINE" }, _max: { wpm: true } });
    expect(db.groupBy.mock.invocationCallOrder[0]).toBeLessThan(db.transaction.mock.invocationCallOrder[0]);
  });

  it.each([
    [null, false], [49, true], [50, false], [51, false],
  ])("meilleur précédent %s : record %s", async (best, expected) => {
    const { room, race } = fixture();
    const db = storage(best);
    expect((await persistRace(room, race, db.db))?.personalBests[0]).toBe(expected);
  });

  it.each(["abandoned", "timeout"] as const)("%s n'est jamais un record, même à la première course", async (status) => {
    const { room, race } = fixture();
    race.results![0].status = status;
    const db = storage();
    expect((await persistRace(room, race, db.db))?.personalBests[0]).toBe(false);
    expect(db.groupBy).not.toHaveBeenCalled();
  });

  it("charge les records de plusieurs inscrits en une seule requête avant la transaction", async () => {
    const { room, race } = fixture();
    room.participants[1].isGuest = false;
    Object.assign(race.results![1], { status: "finished", netMpm: 40 });
    const db = storage();
    db.groupBy.mockResolvedValueOnce([
      { userId: "guest-session", _max: { wpm: 45 } }, { userId: "user", _max: { wpm: 49 } },
    ]);
    expect((await persistRace(room, race, db.db))?.personalBests).toEqual([true, false, false]);
    expect(db.groupBy).toHaveBeenCalledExactlyOnceWith({
      by: ["userId"], where: { userId: { in: ["user", "guest-session"] }, outcome: "TERMINE" }, _max: { wpm: true },
    });
    expect(db.groupBy.mock.invocationCallOrder[0]).toBeLessThan(db.transaction.mock.invocationCallOrder[0]);
  });

  it("déduplique deux fins concurrentes et une fin déjà persistée", async () => {
    const { room, race } = fixture();
    const db = storage();
    const first = persistRace(room, race, db.db);
    expect(persistRace(room, race, db.db)).toBe(first);
    await first;
    expect(await persistRace(room, race, db.db)).toEqual(await first);
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(db.create).toHaveBeenCalledOnce();
  });

  it.each(["groupBy", "transaction"] as const)("permet une nouvelle tentative après un échec de %s et la déduplique", async (operation) => {
    const { room, race } = fixture();
    const db = storage();
    db[operation].mockRejectedValueOnce(new Error("unavailable"));
    await expect(persistRace(room, race, db.db)).rejects.toThrow("unavailable");
    const retry = persistRace(room, race, db.db);
    expect(persistRace(room, race, db.db)).toBe(retry);
    await expect(retry).resolves.toMatchObject({ id: "saved-race" });
    expect(await persistRace(room, race, db.db)).toEqual(await retry);
    expect(db[operation]).toHaveBeenCalledTimes(2);
    expect(db.create).toHaveBeenCalledOnce();
  });
});
