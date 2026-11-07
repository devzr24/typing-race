import { describe, expect, it } from "vitest";
import { passagesFR } from "../../../prisma/corpus/passages-fr";
import { passagesEN } from "../../../prisma/corpus/passages-en";
import { wordsFR } from "../../../prisma/corpus/words-fr";
import { wordsEN } from "../../../prisma/corpus/words-en";
import { matchesRandomComplexity, passageComplexity, passageScore, randomWordWeight } from "./complexity";
import { generateCoherentText, generateRandomText } from "./generate";
import type { TextConfig, TextResult, TextWord } from "./types";

const config: TextConfig = {
  textLanguage: "FR", textType: "ALEATOIRE", wordCount: 200,
  complexity: "MOYEN", punctuation: false, numbers: false, capitals: false,
  accents: true, includeChars: "", excludeChars: "",
};
const dictionary: TextWord[] = [
  ...wordsFR.map((value, index) => ({ language: "FR" as const, value, frequencyRank: index + 1 })),
  ...wordsEN.map((value, index) => ({ language: "EN" as const, value, frequencyRank: index + 1 })),
];
const passages = [...passagesFR, ...passagesEN];
const levels = ["FACILE", "MOYEN", "DIFFICILE"] as const;

function text(result: TextResult): string {
  if (!result.ok) throw new Error(result.reason);
  return result.text;
}

describe("génération du texte", () => {
  for (const language of ["FR", "EN"] as const) {
    for (const complexity of levels) {
      it(`${language}/${complexity} : corpus couvert, déterminisme et nombre exact dans les deux modes`, () => {
        expect(passages.filter((p) => p.language === language && passageComplexity(p) === complexity).length).toBeGreaterThanOrEqual(2);
        const options = { ...config, textLanguage: language, complexity };
        for (const generate of [
          (seed: number) => generateRandomText(dictionary, options, seed),
          (seed: number) => generateCoherentText(passages, options, seed),
        ]) {
          const result = generate(42);
          expect(generate(42)).toEqual(result);
          const output = text(result);
          expect(output.split(" ")).toHaveLength(options.wordCount);
          expect(output).toBe(output.trim());
          expect(output).not.toMatch(/\s{2,}/);
          expect(generate(43)).not.toEqual(result);
        }
        for (const value of text(generateRandomText(dictionary, options, 42)).split(" ")) {
          expect(dictionary.some((w) => w.language === language && w.value === value && matchesRandomComplexity(w, complexity))).toBe(true);
        }
      });
    }
  }

  it("applique les bornes et pondère les mots longs et rares", () => {
    const word = { language: "FR" as const, value: "abcdef", frequencyRank: 300 };
    expect(matchesRandomComplexity(word, "FACILE")).toBe(true);
    expect(matchesRandomComplexity({ ...word, frequencyRank: 301 }, "FACILE")).toBe(false);
    expect(matchesRandomComplexity({ ...word, value: "abcdefg" }, "FACILE")).toBe(false);
    expect(matchesRandomComplexity({ ...word, value: "abcdefghi", frequencyRank: 700 }, "MOYEN")).toBe(true);
    expect(matchesRandomComplexity({ ...word, frequencyRank: 701 }, "MOYEN")).toBe(false);
    expect(matchesRandomComplexity({ ...word, value: "abcdefghij" }, "MOYEN")).toBe(false);
    expect(matchesRandomComplexity({ ...word, value: "abc" }, "DIFFICILE")).toBe(false);
    expect(randomWordWeight(word, "DIFFICILE")).toBe(1800);
    const weighted = Array.from({ length: 20 }, (_, i) => ({ ...word, value: i < 10 ? "court" : "extraordinaire", frequencyRank: i < 10 ? 1 : 1000 }));
    const output = text(generateRandomText(weighted, { ...config, complexity: "DIFFICILE" }, 42));
    expect(output.split(" ").filter((w) => w === "extraordinaire").length).toBeGreaterThan(180);
    expect(passageScore("ab cd!")).toBeCloseTo(4);
    expect(passageScore("")).toBe(0);
  });

  it("insère nombres, virgules, points et majuscules de début de phrase", () => {
    const output = text(generateRandomText(dictionary, { ...config, punctuation: true, numbers: true, capitals: true }, 12));
    expect(output).toMatch(/\d/);
    expect(output).toContain(",");
    expect(output).toContain(".");
    expect(output).toMatch(/(?:^|\. )[A-ZÀ-ÖØ-Þ]/);
    expect(text(generateRandomText(dictionary, config, 12))).not.toMatch(/[\d,.A-Z]/);
    const rates = levels.map((complexity) => (text(generateRandomText(dictionary, { ...config, complexity, punctuation: true, wordCount: 5000 }, 42)).match(/[,.]/g) ?? []).length);
    expect(rates[0]).toBeLessThan(rates[1]);
    expect(rates[1]).toBeLessThan(rates[2]);
  });

  it("retire les accents FR mais conserve ceux EN", () => {
    const accented = Array.from({ length: 20 }, () => ({ language: "FR" as const, value: "été", frequencyRank: 1 }));
    expect(text(generateRandomText(accented, { ...config, accents: false }, 1))).toMatch(/^ete(?: ete)*$/);
    expect(text(generateRandomText(accented, config, 1))).toContain("été");
    const english = accented.map((w) => ({ ...w, language: "EN" as const }));
    expect(text(generateRandomText(english, { ...config, textLanguage: "EN", accents: false }, 1))).toContain("été");
  });

  it("filtre include/exclude sans casse ni accents, y compris les décorations", () => {
    const options = { ...config, includeChars: "É", excludeChars: "À,.0123456789", punctuation: true, numbers: true, capitals: true };
    const output = text(generateRandomText(dictionary, options, 42));
    for (const word of output.split(" ")) {
      const normalized = word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
      expect(normalized).toContain("e");
      expect(normalized).not.toMatch(/[a,.0-9]/);
    }
    const withNumbers = text(generateRandomText(dictionary, { ...config, includeChars: "e", numbers: true }, 42));
    expect(withNumbers).toMatch(/e\w*\d/);
    expect(withNumbers.split(" ").every((w) => w.includes("e") || w.includes("é") || w.includes("è") || w.includes("ê"))).toBe(true);
  });

  it("échoue sous 20 candidats, après filtrage de langue, complexité et caractères", () => {
    expect(generateRandomText(dictionary.slice(0, 19), config, 1)).toEqual({ ok: false, reason: "NOT_ENOUGH_WORDS" });
    for (const options of [{ includeChars: "∅" }, { includeChars: "e", excludeChars: "É" }, { excludeChars: "abcdefghijklmnopqrstuvwxyz" }]) {
      expect(generateRandomText(dictionary, { ...config, ...options }, 1)).toEqual({ ok: false, reason: "NOT_ENOUGH_WORDS" });
    }
    expect(generateRandomText(dictionary.slice(0, 20), { ...config, textLanguage: "EN" }, 1).ok).toBe(false);
    expect(generateRandomText(dictionary.slice(0, 20), { ...config, complexity: "DIFFICILE" }, 1).ok).toBe(false);
    expect(generateRandomText(dictionary.slice(0, 20), config, 1).ok).toBe(true);
  });

  it("enchaîne des passages, transforme les options et ignore include/exclude en cohérent", () => {
    const source = [{ language: "FR" as const, content: "Été, Ici! mot42 -- fin." }];
    const options = { ...config, complexity: passageComplexity(source[0]), wordCount: 8, accents: false, includeChars: "∅", excludeChars: "abcdefghijklmnopqrstuvwxyz" };
    expect(text(generateCoherentText(source, options, 1))).toBe("ete ici fin ete ici fin ete ici");
    const preserved = text(generateCoherentText(source, { ...options, accents: true, capitals: true, numbers: true, punctuation: true }, 1));
    expect(preserved).toBe("Été, Ici! mot42 -- fin. Été, Ici! mot42");
    const two = [{ language: "EN" as const, content: "one two" }, { language: "EN" as const, content: "six ten" }];
    const joined = text(generateCoherentText(two, { ...config, textLanguage: "EN", complexity: "FACILE", wordCount: 6 }, 1));
    expect(["one two six ten one two", "six ten one two six ten"]).toContain(joined);
  });

  it("renvoie NO_PASSAGE en absence de passage exploitable", () => {
    const failure = { ok: false, reason: "NO_PASSAGE" };
    expect(generateCoherentText([], config, 1)).toEqual(failure);
    expect(generateCoherentText(passagesFR, { ...config, textLanguage: "EN" }, 1)).toEqual(failure);
    expect(generateCoherentText([{ language: "FR", content: "a b" }], { ...config, complexity: "DIFFICILE" }, 1)).toEqual(failure);
    const empty = { language: "FR" as const, content: "123 --" };
    expect(generateCoherentText([empty], { ...config, complexity: passageComplexity(empty) }, 1)).toEqual(failure);
  });
});
