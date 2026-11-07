import { createSeededRandom } from "../bots/random";
import { matchesRandomComplexity, passageComplexity, randomWordWeight } from "./complexity";
import type { TextConfig, TextPassage, TextResult, TextWord } from "./types";

function withoutAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalize(value: string): string {
  return withoutAccents(value).toLowerCase();
}

function applyCaseAndAccents(value: string, config: TextConfig): string {
  if (!config.capitals) value = value.toLowerCase();
  if (config.textLanguage === "FR" && !config.accents) value = withoutAccents(value);
  return value;
}

export function generateRandomText(words: readonly TextWord[], config: TextConfig, seed: number): TextResult {
  const include = [...normalize(config.includeChars)];
  const exclude = [...normalize(config.excludeChars)];
  const allowed = (value: string): boolean => {
    const normalized = normalize(value);
    return !exclude.some((character) => normalized.includes(character))
      && (!include.length || include.some((character) => normalized.includes(character)));
  };
  const candidates = words.filter((word) => word.language === config.textLanguage
    && matchesRandomComplexity(word, config.complexity) && allowed(word.value));
  if (candidates.length < 20) return { ok: false, reason: "NOT_ENOUGH_WORDS" };

  const random = createSeededRandom(seed);
  const weights = candidates.map((word) => randomWordWeight(word, config.complexity));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const punctuationRate = { FACILE: 0.08, MOYEN: 0.16, DIFFICILE: 0.24 }[config.complexity];
  const result: string[] = [];
  let sentenceStart = true;
  for (let index = 0; index < config.wordCount; index++) {
    let draw = random() * totalWeight;
    let selected = 0;
    while (selected < candidates.length - 1 && draw >= weights[selected]) {
      draw -= weights[selected++];
    }
    let value = applyCaseAndAccents(candidates[selected].value, config);
    if (config.numbers && random() < 0.1) {
      const number = String(Math.floor(random() * 1000));
      // Un nombre seul peut enfreindre includeChars : conserver alors le mot.
      if (allowed(number)) value = number;
      else if (allowed(value + number)) value += number;
    }
    if (config.capitals && sentenceStart) value = value[0].toUpperCase() + value.slice(1);
    sentenceStart = false;
    if (config.punctuation && random() < punctuationRate) {
      const mark = random() < 0.5 ? "," : ".";
      if (allowed(value + mark)) {
        value += mark;
        sentenceStart = mark === ".";
      }
    }
    result.push(value);
  }
  return { ok: true, text: result.join(" ") };
}

export function generateCoherentText(passages: readonly TextPassage[], config: TextConfig, seed: number): TextResult {
  const candidates = passages.filter((passage) => passage.language === config.textLanguage
    && passageComplexity(passage) === config.complexity).map((passage) => {
    let words = passage.content.trim().split(/\s+/);
    if (!config.numbers) words = words.filter((word) => !/\p{N}/u.test(word));
    let content = words.join(" ");
    if (!config.punctuation) content = content.replace(/[^\p{L}\p{M}\p{N}\s]/gu, "");
    return applyCaseAndAccents(content, config).split(/\s+/).filter(Boolean);
  }).filter((words) => words.length > 0);
  if (!candidates.length) return { ok: false, reason: "NO_PASSAGE" };

  const random = createSeededRandom(seed);
  const result: string[] = [];
  let previous = -1;
  while (result.length < config.wordCount) {
    // Éviter de répéter immédiatement le même extrait quand un autre existe.
    let selected = Math.floor(random() * (candidates.length - (previous >= 0 && candidates.length > 1 ? 1 : 0)));
    if (candidates.length > 1 && previous >= 0 && selected >= previous) selected++;
    result.push(...candidates[selected].slice(0, config.wordCount - result.length));
    previous = selected;
  }
  return { ok: true, text: result.join(" ") };
}
