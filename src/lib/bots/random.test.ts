import { describe, expect, it } from "vitest";
import { createSeededRandom } from "./random";

describe("createSeededRandom", () => {
  it("reproduit Mulberry32 avec des états indépendants", () => {
    const first = createSeededRandom(1);
    const second = createSeededRandom(1);
    expect(first()).toBe(0.6270739405881613);
    expect(second()).toBe(0.6270739405881613);
    for (let index = 0; index < 100; index++) expect(first()).toBe(second());
  });

  it("produit des valeurs dans [0, 1[ et distingue les graines, y compris zéro", () => {
    const sequences = [0, 1, 2, -1].map((seed) => {
      const random = createSeededRandom(seed);
      return Array.from({ length: 1000 }, () => random());
    });
    for (const sequence of sequences) {
      expect(Math.min(...sequence)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...sequence)).toBeLessThan(1);
    }
    expect(new Set(sequences.map((sequence) => sequence.join(","))).size).toBe(4);
  });
});
