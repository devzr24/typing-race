import type { TextConfig, TextPassage, TextWord } from "./types";

export function matchesRandomComplexity(word: TextWord, level: TextConfig["complexity"]): boolean {
  const length = [...word.value].length;
  if (level === "FACILE") return word.frequencyRank <= 300 && length <= 6;
  if (level === "MOYEN") return word.frequencyRank <= 700 && length <= 9;
  return length >= 4;
}

export function randomWordWeight(word: TextWord, level: TextConfig["complexity"]): number {
  return level === "DIFFICILE" ? [...word.value].length * word.frequencyRank : 1;
}

/** Lettres par mot + 10 × part non alphabétique (espaces exclus). */
export function passageScore(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean);
  const characters = [...content.replace(/\s/g, "")];
  if (!words.length || !characters.length) return 0;
  const letters = characters.filter((character) => /\p{L}/u.test(character)).length;
  return letters / words.length + 10 * (characters.length - letters) / characters.length;
}

export function passageComplexity(passage: TextPassage): TextConfig["complexity"] {
  const score = passageScore(passage.content);
  const [easy, medium] = passage.language === "FR" ? [5.2, 5.8] : [4.4, 4.7];
  return score <= easy ? "FACILE" : score <= medium ? "MOYEN" : "DIFFICILE";
}
