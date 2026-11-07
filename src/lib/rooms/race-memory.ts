import type { Race } from "./types";

type ActiveRace = Race & { timer?: ReturnType<typeof setTimeout> };
const RACES_KEY = Symbol.for("typing-race.active-races");
type RaceGlobal = typeof globalThis & { [RACES_KEY]?: Map<string, ActiveRace> };
const shared = globalThis as RaceGlobal;
export const activeRaces = shared[RACES_KEY] ??= new Map<string, ActiveRace>();

export function clearRace(code: string): void {
  clearTimeout(activeRaces.get(code)?.timer);
  activeRaces.delete(code);
}
