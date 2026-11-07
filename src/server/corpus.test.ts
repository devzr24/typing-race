import { describe, expect, it } from "vitest";
import { passagesFR } from "../../prisma/corpus/passages-fr";
import { passagesEN } from "../../prisma/corpus/passages-en";
import { wordsFR } from "../../prisma/corpus/words-fr";
import { wordsEN } from "../../prisma/corpus/words-en";

describe("intégrité du corpus", () => {
  it("utilise des slugs uniques pour tous les extraits", () => {
    const passages = [...passagesFR, ...passagesEN];
    expect(new Set(passages.map(({ slug }) => slug)).size).toBe(passages.length);
  });

  for (const [language, passages, words] of [
    ["FR", passagesFR, wordsFR],
    ["EN", passagesEN, wordsEN],
  ] as const) {
    it(`utilise une ponctuation tapable au clavier en ${language}`, () => {
      for (const passage of passages) {
        expect(passage.content).not.toMatch(/[’‘“”«»—–…\u00a0\u202f]/u);
      }
    });

    it(`contient 20 extraits attribués de 40 à 150 mots en ${language}`, () => {
      expect(passages).toHaveLength(20);
      for (const passage of passages) {
        expect(passage.language).toBe(language);
        expect(passage.slug.trim()).not.toBe("");
        expect(passage.title.trim()).not.toBe("");
        expect(passage.author.trim()).not.toBe("");
        const count = passage.content.trim().split(/\s+/u).length;
        expect(passage.wordCount).toBe(count);
        expect(count).toBeGreaterThanOrEqual(40);
        expect(count).toBeLessThanOrEqual(150);
      }
    });

    it(`contient 1000 mots uniques en minuscules et sans espace en ${language}`, () => {
      expect(words).toHaveLength(1000);
      expect(new Set(words).size).toBe(words.length);
      for (const word of words) {
        expect(word).not.toBe("");
        expect(word).toBe(word.toLowerCase());
        expect(word).not.toMatch(/\s/u);
      }
    });
  }
});
