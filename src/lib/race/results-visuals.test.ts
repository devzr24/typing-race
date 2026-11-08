import { describe, expect, it } from "vitest";
import { chartScales, keyboardMisses, keyboardRows, keyIntensity } from "./results-visuals";

describe("échelles du graphique", () => {
  it("reste finie et non nulle sans données ou avec des séries à zéro", () => {
    for (const results of [[], [{ series: [{ t: 0, mpm: 0 }], netMpm: 0, elapsedMs: undefined }]]) {
      const scales = chartScales(results);
      expect(scales.maxTime).toBe(1);
      expect(scales.maxMpm).toBe(1);
      expect(scales.x(0)).toBe(60);
      expect(scales.y(0)).toBe(240);
    }
  });
  it("inclut tous les points et le résultat final, et arrondit les graduations", () => {
    const scales = chartScales([
      { series: [{ t: 5000, mpm: 123 }], elapsedMs: 12_000, netMpm: 100 },
      { series: [{ t: 15_000, mpm: 20 }], elapsedMs: 17_000, netMpm: 142 },
    ]);
    expect(scales.maxTime).toBe(20);
    expect(scales.maxMpm).toBe(200);
    expect(scales.x(20_000)).toBe(660);
    expect(scales.y(200)).toBe(40);
    expect(scales.x(-1)).toBe(60);
    expect(scales.y(300)).toBe(40);
  });
});

describe("carte de chaleur du clavier", () => {
  it("normalise l'intensité et gère l'absence d'erreurs", () => {
    expect(keyIntensity(0, 0)).toBe(0);
    expect(keyIntensity(0, 10)).toBe(0);
    expect(keyIntensity(5, 10)).toBe(0.5);
    expect(keyIntensity(20, 10)).toBe(1);
    expect(keyIntensity(-1, 10)).toBe(0);
  });
  it("affiche les dispositions AZERTY et QWERTY", () => {
    expect(keyboardRows("fr")[1].join("")).toContain("azerty");
    expect(keyboardRows("en")[1].join("")).toContain("qwerty");
  });
  it("regroupe majuscules et accents sans perdre les touches ou espaces manqués", () => {
    expect(keyboardMisses({ A: 2, a: 1, é: 3, è: 1, É: 1, " ": 2, "?": 1 }, "fr"))
      .toEqual({ a: 3, é: 4, è: 1, " ": 2, ",": 1 });
    expect(keyboardMisses({ É: 2, e: 1 }, "en")).toEqual({ e: 3 });
  });
  it("place les chiffres et la ponctuation sur leur touche physique selon la langue", () => {
    expect(keyboardMisses({ "1": 2, "&": 1, "2": 3, é: 1, "?": 2, ",": 1 }, "fr"))
      .toEqual({ "&": 3, é: 4, ",": 3 });
    expect(keyboardMisses({ "!": 2, "1": 1, "?": 2, "/": 1, "|": 1 }, "en"))
      .toEqual({ "1": 3, "/": 3, "\\": 1 });
  });
});
