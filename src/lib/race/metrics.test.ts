import { describe, expect, it } from "vitest";
import { accuracy, grossMpm, isPlausibleProgress, netMpm, progress } from "./metrics";

describe("métriques (Annexe A)", () => {
  it("calcule les MPM et la précision à la main, espaces inclus", () => {
    expect(netMpm(250, 30_000)).toBe(100);
    expect(grossMpm(300, 30_000)).toBe(120);
    expect(accuracy(250, 300)).toBeCloseTo(83.333333);
    expect(progress("un mot ".length, "un mot ici".length)).toBe(0.7);
  });

  it("traite les compteurs nuls et borne la progression", () => {
    expect(netMpm(20, 0)).toBe(0);
    expect(grossMpm(20, 0)).toBe(0);
    expect(accuracy(0, 0)).toBe(100);
    expect(accuracy(0, 10)).toBe(0);
    expect(progress(0, 0)).toBe(0);
    expect(progress(-1, 10)).toBe(0);
    expect(progress(11, 10)).toBe(1);
  });
});

describe("isPlausibleProgress", () => {
  const base = { prevPosition: 20, newPosition: 25, raceElapsedMs: 1_000, textLength: 100 };
  it("accepte exactement 300 MPM et une position inchangée", () => {
    expect(isPlausibleProgress(base)).toBe(true);
    expect(isPlausibleProgress({ ...base, newPosition: 20 })).toBe(true);
    expect(isPlausibleProgress({ ...base, newPosition: 40, raceElapsedMs: 1_600 })).toBe(true);
  });
  it("accepte la gigue de 10 ms avec une moyenne de 150 MPM", () => {
    expect(isPlausibleProgress({ ...base, prevPosition: 123, newPosition: 124, raceElapsedMs: 9_990, textLength: 200 })).toBe(true);
    expect(isPlausibleProgress({ ...base, prevPosition: 124, newPosition: 125, raceElapsedMs: 10_000, textLength: 200 })).toBe(true);
  });
  it("accorde une grâce jusqu'à 20 caractères au début de course", () => {
    expect(isPlausibleProgress({ ...base, prevPosition: 0, newPosition: 0, raceElapsedMs: 0 })).toBe(true);
    expect(isPlausibleProgress({ ...base, prevPosition: 0, newPosition: 20, raceElapsedMs: 0 })).toBe(true);
    expect(isPlausibleProgress({ ...base, newPosition: 21, raceElapsedMs: 1 })).toBe(false);
  });
  it("rejette recul, saut, vitesse moyenne excessive et déplacement à 0 ms après la grâce", () => {
    expect(isPlausibleProgress({ ...base, newPosition: 19 })).toBe(false);
    expect(isPlausibleProgress({ ...base, newPosition: 41, raceElapsedMs: 60_000 })).toBe(false);
    expect(isPlausibleProgress({ ...base, raceElapsedMs: 999 })).toBe(false);
    expect(isPlausibleProgress({ ...base, raceElapsedMs: 0 })).toBe(false);
  });
  it("rejette les positions hors texte et les nombres invalides", () => {
    expect(isPlausibleProgress({ ...base, newPosition: 101 })).toBe(false);
    expect(isPlausibleProgress({ ...base, prevPosition: -1 })).toBe(false);
    expect(isPlausibleProgress({ ...base, newPosition: 10.5 })).toBe(false);
    expect(isPlausibleProgress({ ...base, raceElapsedMs: Infinity })).toBe(false);
    expect(isPlausibleProgress({ ...base, raceElapsedMs: NaN })).toBe(false);
    expect(isPlausibleProgress({ ...base, raceElapsedMs: -1 })).toBe(false);
  });
});
