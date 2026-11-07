import { beforeEach, expect, it, vi } from "vitest";
import { generateCoherentText, generateRandomText } from "./generate";
import { loadRaceText } from "./load";
import type { TextConfig } from "./types";

const mocks = vi.hoisted(() => ({ words: vi.fn(), passages: vi.fn() }));
vi.mock("../prisma", () => ({ prisma: { word: { findMany: mocks.words }, passage: { findMany: mocks.passages } } }));
const config: TextConfig = {
  textLanguage: "EN", textType: "ALEATOIRE", wordCount: 30, complexity: "FACILE",
  punctuation: false, numbers: false, capitals: false, accents: true, includeChars: "", excludeChars: "",
};
beforeEach(() => vi.clearAllMocks());

it("charge uniquement le dictionnaire de la langue dans un ordre stable", async () => {
  const words = Array.from({ length: 20 }, () => ({ language: "EN" as const, value: "word", frequencyRank: 1 }));
  mocks.words.mockResolvedValue(words);
  expect(await loadRaceText(config, 12)).toEqual(generateRandomText(words, config, 12));
  expect(mocks.words).toHaveBeenCalledWith({
    where: { language: "EN" }, orderBy: [{ frequencyRank: "asc" }, { value: "asc" }],
    select: { language: true, value: true, frequencyRank: true },
  });
  expect(mocks.passages).not.toHaveBeenCalled();
});

it("charge uniquement les passages puis propage le résultat pur et ses échecs", async () => {
  const options = { ...config, textType: "COHERENT" as const };
  const passages = [{ language: "EN" as const, content: "one two" }];
  mocks.passages.mockResolvedValue(passages);
  expect(await loadRaceText(options, 12)).toEqual(generateCoherentText(passages, options, 12));
  expect(mocks.passages).toHaveBeenCalledWith({
    where: { language: "EN" }, orderBy: { slug: "asc" }, select: { language: true, content: true },
  });
  expect(mocks.words).not.toHaveBeenCalled();
  mocks.passages.mockResolvedValue([]);
  expect(await loadRaceText(options, 12)).toEqual({ ok: false, reason: "NO_PASSAGE" });
  mocks.words.mockResolvedValue([]);
  expect(await loadRaceText(config, 12)).toEqual({ ok: false, reason: "NOT_ENOUGH_WORDS" });
});
