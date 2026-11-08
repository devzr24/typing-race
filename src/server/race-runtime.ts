import { createBotRunner } from "@/lib/bots/engine";
import type { BotLevel } from "@/lib/bots/levels";
import {
  abandon, applyKeys, createRaceState, isOver, raceSelf, raceSnapshot, sampleSeries, timeoutRemaining,
  type KeysResult, type RaceSelf,
} from "@/lib/race/engine";
import { activeRaces, type ActiveRace } from "@/lib/rooms/race-memory";
import { finishRace } from "@/lib/rooms/service";
import { persistRace } from "@/lib/race/persist";
import type { RoomStore } from "@/lib/rooms/store";
import type { Room } from "@/lib/rooms/types";
import type { ServerToClientEvents } from "@/lib/rooms/events";

export type RaceTransport = {
  room(...args: { [E in "race:state" | "race:bonus" | "race:results"]: [code: string, event: E, payload: Parameters<ServerToClientEvents[E]>[0]] }["race:state" | "race:bonus" | "race:results"]): void;
  self(code: string, id: string, payload: RaceSelf): void;
};
const TRANSPORT_KEY = Symbol.for("typing-race.race-transport");
type TransportGlobal = typeof globalThis & { [TRANSPORT_KEY]?: RaceTransport };
export function setRaceTransport(transport: RaceTransport): void {
  (globalThis as TransportGlobal)[TRANSPORT_KEY] = transport;
}
const transport = () => (globalThis as TransportGlobal)[TRANSPORT_KEY];

function botSeed(seed: number, id: string): number {
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619);
  return seed >>> 0;
}

export function startRaceRuntime(store: RoomStore, room: Room, race: ActiveRace, publish: (code: string) => Promise<void>): void {
  if (race.runtime || activeRaces.get(room.code) !== race) return;
  const state = race.state = createRaceState(room, race.text, race.startsAt, race.seed ?? 0);
  race.sessions = new Map(room.participants.filter((p) => !p.isSpectator).map((p) => [
    p.key, { id: p.id, inputTimes: [], sequence: -1 },
  ]));
  let stopped = false;
  let finishing = false;
  let dirty = true;
  let lastSnapshot = "";
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const limitAt = state.config.timeLimitSec === null ? Infinity : state.startsAt + state.config.timeLimitSec * 1000;
  const current = () => !stopped && activeRaces.get(room.code) === race;

  function sendSelf(id: string) {
    const self = raceSelf(state, id);
    if (self) transport()?.self(room.code, id, self);
  }
  function finish() {
    if (!current() || finishing || !isOver(state)) return;
    finishing = true;
    void finishRace(store, room.code).then(async (result) => {
      if (!result.ok) finishing = false;
      if (result.ok) {
        try {
          const saved = await persistRace(room, race);
          if (saved) race.results?.forEach((r, index) => {
            r.raceId = saved.id;
            r.isPersonalBest = saved.personalBests[index];
          });
        } catch (error: unknown) { console.error("> race persist", error); }
      }
      if (result.ok && activeRaces.get(room.code) === race && race.results) {
        await publish(room.code);
        transport()?.room(room.code, "race:results", race.results);
      }
    }).catch((error: unknown) => { finishing = false; console.error("> race finish", error); });
  }
  function expire(): boolean {
    if (Date.now() < limitAt) return false;
    timeoutRemaining(state, limitAt);
    dirty = true;
    finish();
    return true;
  }
  function input(id: string, keys: string): KeysResult {
    if (!current() || finishing || expire()) return { ok: false, error: "raceNotRacing" };
    const result = applyKeys(state, id, keys, Date.now());
    if (result.ok) {
      dirty = true;
      for (const grant of result.bonuses) {
        transport()?.room(room.code, "race:bonus", grant);
        sendSelf(grant.targetId);
      }
      finish();
    }
    return result;
  }

  const broadcast = setInterval(() => {
    if (!current() || !dirty) return;
    const snapshot = raceSnapshot(state, Date.now());
    const serialized = JSON.stringify(snapshot.racers);
    if (serialized !== lastSnapshot) {
      transport()?.room(room.code, "race:state", snapshot);
      lastSnapshot = serialized;
    }
    dirty = false;
  }, 100);
  const sampling = setInterval(() => {
    if (!current() || expire()) return;
    sampleSeries(state, Date.now());
    dirty = true;
  }, 1000);
  race.runtime = {
    input,
    abandon(id) {
      if (!current() || finishing || expire()) return false;
      const changed = abandon(state, id, Date.now());
      if (changed) { dirty = true; finish(); }
      return changed;
    },
    stop() {
      stopped = true;
      clearInterval(broadcast);
      clearInterval(sampling);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  };
  for (const racer of state.racers) if (!racer.isBot) sendSelf(racer.id);
  for (const bot of room.bots) {
    const runner = createBotRunner({
      level: bot.level.toLowerCase() as BotLevel,
      seed: botSeed(state.seed, bot.id), errorMode: state.config.errorMode === "CORRECTION" ? "correction" : "libre",
    });
    const racer = state.racers.find((r) => r.id === bot.id)!;
    const schedule = () => {
      if (!current() || finishing || racer.status !== "racing") return;
      const stroke = runner.next(racer.text, racer.position);
      if (!stroke) return;
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!current()) return;
        const expected = racer.text[racer.position];
        input(bot.id, stroke.correct ? expected : expected === "x" ? "y" : "x");
        schedule();
      }, stroke.delayMs);
      timers.add(timer);
    };
    schedule();
  }
  if (Number.isFinite(limitAt)) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!current()) return;
      timeoutRemaining(state, limitAt);
      dirty = true;
      finish();
    }, Math.max(0, limitAt - Date.now()));
    timers.add(timer);
  }
  finish();
}
