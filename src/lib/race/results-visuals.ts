import type { RaceResults } from "./engine";
import type { Locale } from "@/i18n/config";

export type ResultRow = Pick<RaceResults[number],
  "id" | "name" | "image" | "isBot" | "rank" | "netMpm" | "grossMpm" | "accuracy" |
  "errors" | "elapsedMs" | "status" | "bonuses" | "series" | "missedKeys" | "raceId" | "isPersonalBest">;

function axisMaximum(value: number): number {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

export function chartScales(results: readonly Pick<ResultRow, "series" | "elapsedMs" | "netMpm">[]) {
  const maxTime = axisMaximum(Math.max(0, ...results.flatMap((r) => [r.elapsedMs ?? 0, ...r.series.map((p) => p.t)])) / 1000);
  const maxMpm = axisMaximum(Math.max(0, ...results.flatMap((r) => [r.netMpm, ...r.series.map((p) => p.mpm)])));
  return {
    maxTime, maxMpm,
    x: (timeMs: number) => 60 + Math.max(0, Math.min(1, timeMs / (maxTime * 1000))) * 600,
    y: (mpm: number) => 240 - Math.max(0, Math.min(1, mpm / maxMpm)) * 200,
  };
}

export function keyIntensity(count: number, max: number): number {
  return max <= 0 ? 0 : Math.max(0, Math.min(1, count / max));
}

export function keyboardRows(locale: Locale): string[][] {
  return (locale === "fr"
    ? ["²&é\"'(-è_çà)=", "azertyuiop^$", "qsdfghjklmù*", "<wxcvbn,;:!"]
    : ["`1234567890-=", "qwertyuiop[]\\", "asdfghjkl;'", "zxcvbnm,./"]).map((row) => [...row]);
}

// Majuscules et caractères avec Majuscule partagent leur touche physique.
export function keyboardMisses(missed: Record<string, number>, locale: Locale): Record<string, number> {
  const keys = new Set(keyboardRows(locale).flat());
  const shiftedRows = locale === "fr"
    ? [["1234567890°+", "&é\"'(-è_çà)="], ["¨£", "^$"], ["%µ", "ù*"], [">?./§", "<,;:!"]]
    : [["~!@#$%^&*()_+", "`1234567890-="], ["{}|", "[]\\"], [":\"", ";'"], ["<>?", ",./"]];
  const shifted = new Map(shiftedRows.flatMap(([upper, base]) => [...upper].map((key, index) => [key, base[index]] as const)));
  const counts: Record<string, number> = Object.create(null);
  for (const [character, count] of Object.entries(missed)) {
    const lower = character.toLocaleLowerCase(locale);
    const key = lower === " " || keys.has(lower) ? lower : shifted.get(lower) ?? lower.normalize("NFD").replace(/\p{M}/gu, "");
    counts[key] = (counts[key] ?? 0) + count;
  }
  return counts;
}
