import type { Prisma } from "@/generated/prisma/client";
import type { ActiveRace } from "@/lib/rooms/race-memory";
import type { Room } from "@/lib/rooms/types";

type Transaction = Pick<Prisma.TransactionClient, "race">;
export type RaceStorage = {
  raceResult: Pick<Prisma.TransactionClient["raceResult"], "groupBy">;
  $transaction<T>(write: (tx: Transaction) => Promise<T>): Promise<T>;
};
type Persisted = { id: string; personalBests: boolean[] };
// La même finalisation (y compris concurrente) ne peut produire deux écritures.
const pending = new WeakMap<ActiveRace, Promise<Persisted | null>>();
const outcomes = { finished: "TERMINE", timeout: "TEMPS_ECOULE", abandoned: "ABANDON" } as const;

export function persistRace(room: Room, race: ActiveRace, storage?: RaceStorage): Promise<Persisted | null> {
  const previous = pending.get(race);
  if (previous) return previous;
  const write = async (): Promise<Persisted | null> => {
    const results = race.results;
    const state = race.state;
    if (!results || !state) return null;
    // L'instantané du départ conserve aussi les humains ayant quitté la salle.
    const participants = new Map(room.participants.filter((p) => !p.isSpectator).map((p) => [p.id, p]));
    const userIds = results.map((r) => {
      const participant = participants.get(r.id);
      return !r.isBot && participant && !participant.isGuest ? participant.key : null;
    });
    if (!userIds.some(Boolean)) return null;
    const db: RaceStorage = storage ?? (await import("@/lib/prisma")).prisma;
    const finishedUserIds = userIds.filter((id, index): id is string => id !== null && results[index].status === "finished");
    const bests = finishedUserIds.length ? await db.raceResult.groupBy({
      by: ["userId"], where: { userId: { in: finishedUserIds }, outcome: "TERMINE" }, _max: { wpm: true },
    }) : [];
    const previousBests = new Map(bests.map((best) => [best.userId, best._max.wpm]));
    const personalBests = results.map((result, index) => {
      const best = previousBests.get(userIds[index]);
      return result.status === "finished" && best != null && result.netMpm > best;
    });
    return db.$transaction(async (tx) => {
      const saved = await tx.race.create({ data: {
        roomCode: room.code, text: state.text, config: { ...state.config },
        startedAt: new Date(state.startsAt), endedAt: new Date(state.now),
        results: { create: results.map((r, index) => ({
          userId: userIds[index], displayName: r.name, image: r.image,
          kind: r.isBot ? "BOT" : userIds[index] ? "UTILISATEUR" : "INVITE",
          rank: r.rank, wpm: r.netMpm, rawWpm: r.grossMpm, accuracy: r.accuracy,
          errors: r.errors, timeMs: r.elapsedMs ?? null, outcome: outcomes[r.status],
          wpmSeries: r.series, missedKeys: r.missedKeys, bonuses: r.bonuses,
          isPersonalBest: personalBests[index],
        })) },
      }, select: { id: true } });
      return { id: saved.id, personalBests };
    });
  };
  const promise = write().catch((error: unknown) => {
    pending.delete(race);
    throw error;
  });
  pending.set(race, promise);
  return promise;
}
