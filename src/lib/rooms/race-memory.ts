import type { Race } from "./types";
import type { KeysResult, RaceResults, RaceState } from "@/lib/race/engine";

export type ActiveRace = Race & {
  seed?: number;
  timer?: ReturnType<typeof setTimeout>;
  state?: RaceState;
  sessions?: Map<string, { id: string; inputTimes: number[]; sequence: number }>;
  results?: RaceResults;
  runtime?: {
    input(id: string, keys: string): KeysResult;
    abandon(id: string): boolean;
    stop(): void;
  };
};
const RACES_KEY = Symbol.for("typing-race.active-races");
type RaceGlobal = typeof globalThis & { [RACES_KEY]?: Map<string, ActiveRace> };
const shared = globalThis as RaceGlobal;
export const activeRaces = shared[RACES_KEY] ??= new Map<string, ActiveRace>();

export function clearRace(code: string): void {
  const race = activeRaces.get(code);
  clearTimeout(race?.timer);
  race?.runtime?.stop();
  activeRaces.delete(code);
}
