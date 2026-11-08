import { describe, expect, it } from "vitest";
import { profileStats } from "./stats";

describe("statistiques de profil", () => {
  it("retourne zéro sans course", () => {
    expect(profileStats([])).toEqual({ count: 0, wins: 0, bestWpm: 0, averageWpm: 0, averageAccuracy: 0 });
  });

  it("calcule maximum, moyennes et victoires terminées uniquement", () => {
    expect(profileStats([
      { wpm: 60, accuracy: 100, rank: 1, outcome: "TERMINE" },
      { wpm: 40, accuracy: 80, rank: 2, outcome: "TERMINE" },
      { wpm: 20, accuracy: 60, rank: 1, outcome: "ABANDON" },
      { wpm: 80, accuracy: 80, rank: 1, outcome: "TEMPS_ECOULE" },
    ])).toEqual({ count: 4, wins: 1, bestWpm: 60, averageWpm: 50, averageAccuracy: 90 });
  });

  it("retourne des performances nulles sans course terminée", () => {
    expect(profileStats([
      { wpm: 100, accuracy: 90, rank: 1, outcome: "ABANDON" },
      { wpm: 80, accuracy: 80, rank: 1, outcome: "TEMPS_ECOULE" },
    ])).toEqual({ count: 2, wins: 0, bestWpm: 0, averageWpm: 0, averageAccuracy: 0 });
  });
});
