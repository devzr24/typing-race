import type { ErrorCode } from "@/i18n/messages";
import type { RaceConfig, Room } from "@/lib/rooms/types";
import { createSeededRandom } from "@/lib/bots/random";
import { addWords, allocateBonuses, FOG_DURATION_MS, removeWords, type BonusGrant, type Checkpoint } from "./bonus";
import { accuracy, grossMpm, isPlausibleProgress, MAX_CHARACTERS_PER_MESSAGE, netMpm, progress } from "./metrics";
import { rankParticipants } from "./ranking";

export type RacerStatus = "racing" | "finished" | "abandoned" | "timeout";
export type ReceivedBonus = BonusGrant & { atMs: number };
export type Racer = {
  id: string; name: string; isBot: boolean; image: string | null; joinedAt: number;
  text: string; position: number; totalKeystrokes: number; correctKeystrokes: number;
  errors: number; missedKeys: Record<string, number>; series: { t: number; mpm: number }[];
  status: RacerStatus; finishMs?: number; elapsedMs?: number; abandonedProgress?: number;
  bonuses: ReceivedBonus[]; fogUntil: number;
};
export type RaceState = {
  racers: Racer[]; text: string; config: RaceConfig; seed: number; startsAt: number;
  usedCheckpoints: Checkpoint[]; bonusCount: number; lastSample: number; now: number;
};

export function createRaceState(room: Room, text: string, startsAt: number, seed: number): RaceState {
  const racers = [
    ...room.participants.filter((p) => !p.isSpectator).map((p) => ({
      id: p.id, name: p.displayName, image: p.image, isBot: false, joinedAt: p.joinedAt.getTime(),
    })),
    ...room.bots.map((b, index) => ({ id: b.id, name: b.name, image: null, isBot: true, joinedAt: startsAt + index })),
  ].map((p): Racer => ({
    ...p, text, position: 0, totalKeystrokes: 0, correctKeystrokes: 0, errors: 0,
    missedKeys: Object.create(null), series: [], status: "racing", bonuses: [], fogUntil: 0,
  }));
  return { racers, text, config: { ...room.config }, seed, startsAt, usedCheckpoints: [], bonusCount: 0, lastSample: 0, now: startsAt };
}

export function racerProgress(racer: Racer): number {
  return racer.abandonedProgress ?? progress(racer.position, racer.text.length);
}

export function racerMpm(state: RaceState, racer: Racer, now: number): number {
  return netMpm(racer.correctKeystrokes, racer.elapsedMs ?? Math.max(0, now - state.startsAt));
}

function grantBonuses(state: RaceState, previous: number, now: number): BonusGrant[] {
  if (!state.config.bonusesEnabled) return [];
  const allocation = allocateBonuses({
    participants: state.racers.map((r) => ({
      id: r.id, status: r.status === "timeout" ? "abandoned" : r.status,
      progress: racerProgress(r), joinedAt: r.joinedAt, bonusesReceived: r.bonuses.length,
    })),
    previous, current: Math.max(0, ...state.racers.map(racerProgress)),
    used: state.usedCheckpoints, seed: state.seed + state.bonusCount,
  });
  state.usedCheckpoints = allocation.used;
  const words = state.text.split(/\s+/).filter(Boolean);
  for (const grant of allocation.grants) {
    state.racers.find((r) => r.id === grant.playerId)!.bonuses.push({ ...grant, atMs: now - state.startsAt });
    const target = state.racers.find((r) => r.id === grant.targetId)!;
    if (grant.type === "minus3") target.text = removeWords(target.text, target.position, 3);
    if (grant.type === "plus3") {
      const random = createSeededRandom(state.seed + state.bonusCount);
      target.text = addWords(target.text, target.position, Array.from({ length: 3 }, () => words[Math.floor(random() * words.length)]));
    }
    if (grant.type === "fog") target.fogUntil = now + FOG_DURATION_MS;
    state.bonusCount++;
  }
  return allocation.grants;
}

export type KeysResult = { ok: true; position: number; errors: number; bonuses: BonusGrant[] } | { ok: false; error: ErrorCode };

// Mutations seulement après validation du message entier, positions en unités UTF-16.
export function applyKeys(state: RaceState, id: string, keys: string, now: number): KeysResult {
  const racer = state.racers.find((r) => r.id === id);
  if (!racer || racer.status !== "racing") return { ok: false, error: "raceNotRacing" };
  if (now < state.startsAt) return { ok: false, error: "raceNotStarted" };
  if (keys.length > MAX_CHARACTERS_PER_MESSAGE) return { ok: false, error: "raceInputInvalid" };
  let position = racer.position;
  for (let i = 0; i < keys.length && position < racer.text.length; i++) {
    if (keys[i] === racer.text[position] || state.config.errorMode === "LIBRE") position++;
  }
  if (!isPlausibleProgress({ prevPosition: racer.position, newPosition: position, raceElapsedMs: now - state.startsAt, textLength: racer.text.length })) {
    return { ok: false, error: "raceImplausible" };
  }
  state.now = now;
  const bonuses: BonusGrant[] = [];
  for (let i = 0; i < keys.length && racer.position < racer.text.length; i++) {
    const previous = Math.max(0, ...state.racers.map(racerProgress));
    const expected = racer.text[racer.position];
    const correct = keys[i] === expected;
    racer.totalKeystrokes++;
    if (correct) racer.correctKeystrokes++;
    else {
      racer.errors++;
      racer.missedKeys[expected] = (racer.missedKeys[expected] ?? 0) + 1;
    }
    if (correct || state.config.errorMode === "LIBRE") {
      racer.position++;
      if (racer.position === racer.text.length) {
        racer.status = "finished";
        racer.finishMs = racer.elapsedMs = now - state.startsAt;
      }
      bonuses.push(...grantBonuses(state, previous, now));
    }
  }
  return { ok: true, position: racer.position, errors: racer.errors, bonuses };
}

export function abandon(state: RaceState, id: string, now: number): boolean {
  const racer = state.racers.find((r) => r.id === id);
  if (!racer || racer.status !== "racing") return false;
  racer.abandonedProgress = racerProgress(racer);
  racer.status = "abandoned";
  racer.elapsedMs = Math.max(0, now - state.startsAt);
  state.now = now;
  return true;
}

export function sampleSeries(state: RaceState, now: number): void {
  const second = Math.floor((now - state.startsAt) / 1000);
  if (second <= state.lastSample) return;
  state.lastSample = second;
  state.now = now;
  for (const racer of state.racers) {
    if (racer.status === "racing") racer.series.push({ t: second * 1000, mpm: racerMpm(state, racer, now) });
  }
}

export function timeoutRemaining(state: RaceState, now = state.startsAt + (state.config.timeLimitSec ?? 0) * 1000): void {
  state.now = now;
  for (const racer of state.racers) {
    if (racer.status !== "racing") continue;
    racer.status = "timeout";
    racer.elapsedMs = Math.max(0, now - state.startsAt);
  }
}

export function isOver(state: RaceState): boolean {
  return state.racers.every((r) => r.status !== "racing");
}

export function finalResults(state: RaceState) {
  return rankParticipants(state.racers.map((r) => ({
    id: r.id, name: r.name, isBot: r.isBot, image: r.image, joinedAt: r.joinedAt,
    status: r.status as Exclude<RacerStatus, "racing">, finishMs: r.finishMs,
    progress: racerProgress(r), position: r.position, textLength: r.text.length,
    netMpm: racerMpm(state, r, state.now), grossMpm: grossMpm(r.totalKeystrokes, r.elapsedMs ?? state.now - state.startsAt),
    accuracy: accuracy(r.correctKeystrokes, r.totalKeystrokes), errors: r.errors,
    elapsedMs: r.elapsedMs, bonuses: r.bonuses.map((b) => ({ ...b })),
    series: r.series.map((point) => ({ ...point })), missedKeys: { ...r.missedKeys },
    raceId: undefined as string | undefined, isPersonalBest: false,
  })));
}

export type RaceResults = ReturnType<typeof finalResults>;
export type RaceSelf = Pick<Racer, "text" | "position" | "errors" | "fogUntil">;

export function raceSelf(state: RaceState, id: string): RaceSelf | undefined {
  const racer = state.racers.find((r) => r.id === id);
  return racer && { text: racer.text, position: racer.position, errors: racer.errors, fogUntil: racer.fogUntil };
}

export function raceSnapshot(state: RaceState, now: number) {
  return { serverNow: now, racers: state.racers.map((r) => ({
    id: r.id, name: r.name, isBot: r.isBot, image: r.image,
    position: r.position, textLength: r.text.length, progress: racerProgress(r),
    mpm: racerMpm(state, r, now), status: r.status, bonuses: r.bonuses.map((b) => ({ ...b })),
  })) };
}

export type RaceSnapshot = ReturnType<typeof raceSnapshot>;
