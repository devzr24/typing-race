import { BOT_LEVELS, type BotLevel } from "./levels";
import { createSeededRandom } from "./random";

export type ErrorMode = "correction" | "libre";

export interface BotKeystroke {
  delayMs: number;
  correct: boolean;
}

export interface BotRunner {
  // Position en unités UTF-16 ; null si position >= text.length (terminé).
  next(text: string, position: number): BotKeystroke | null;
}

export interface BotOptions {
  level: BotLevel;
  seed: number;
  errorMode: ErrorMode;
}

export interface BotSimulation {
  // Position après la frappe ; les erreurs corrigées restent dans errors.
  keystrokes: Array<BotKeystroke & { atMs: number; position: number }>;
  totalMs: number;
  correctChars: number;
  typedChars: number;
  errors: number;
}

function wordDifficulty(word: string): number {
  return (
    1 + Math.min(0.25, Math.max(0, word.length - 6) * 0.025) +
    (/\p{P}/u.test(word) ? 0.08 : 0) +
    (/\p{N}/u.test(word) ? 0.1 : 0) +
    (/\p{Lu}/u.test(word) ? 0.05 : 0) +
    (/\p{M}/u.test(word.normalize("NFD")) ? 0.06 : 0)
  );
}

// Déterministe à options identiques pour une même séquence d'appels (text, position).
export function createBotRunner(options: BotOptions): BotRunner {
  const level = BOT_LEVELS[options.level];
  const random = createSeededRandom(options.seed);
  // Marge de 10 % aux bornes pour les fluctuations des courses courtes.
  const baseWpm = level.minWpm + (0.1 + random() * 0.8) * (level.maxWpm - level.minWpm);
  const targetInterval = 12000 / baseWpm;
  const correction = options.errorMode === "correction";
  // Une correction garantie suit chaque erreur : errors / typedChars reste la cible.
  const errorChance = correction
    ? level.errorRate / (1 - level.errorRate)
    : level.errorRate;
  // Budget moyen en MPM net, coût des erreurs compris.
  const timeBudget = correction
    ? 1 / (1 + 3 * errorChance)
    : (1 - level.errorRate) / (1 + 0.5 * level.errorRate);
  let wordStart = -1;
  let currentWord = "";
  let rhythm = 1;
  let timingDebt = 0;
  let pending: { position: number; delayMs: number; interval: number } | null = null;

  return {
    next(text, position) {
      if (!Number.isInteger(position) || position < 0) {
        throw new RangeError("position");
      }
      if (position >= text.length) return null;

      // Relire seulement le mot courant, même si le texte vient de changer.
      let start = position;
      while (start > 0 && !/\s/u.test(text[start - 1])) start--;
      let end = position;
      while (end < text.length && !/\s/u.test(text[end])) end++;
      const word = text.slice(start, end);
      let pause = 0;
      if (start !== wordStart || word !== currentWord) {
        wordStart = start;
        currentWord = word;
        rhythm = 0.85 + random() * 0.3;
        // Hésitation sur 6 % des mots, de 1 à 3 intervalles de frappe.
        if (word && random() < 0.06) pause = 1 + random() * 2;
      }
      // Résorber le retard réel sur 12 intervalles, pauses et erreurs comprises.
      const adjustment = Math.max(0.25, Math.min(2, 1 - timingDebt / (12 * targetInterval)));
      const interval = targetInterval * timeBudget * wordDifficulty(word) / rhythm * adjustment;
      let delayMs = interval * (0.92 + random() * 0.16 + pause);

      let correct = true;
      if (pending?.position === position) {
        // Réaction et retour arrière : 1,5 à 2,5 intervalles de l'erreur en plus.
        delayMs = Math.max(delayMs, pending.delayMs) + pending.interval * (1.5 + random());
        pending = null;
      } else {
        pending = null;
        correct = random() >= errorChance;
        if (!correct) {
          if (correction) pending = { position, delayMs, interval };
          else delayMs += interval * 0.5;
        }
      }
      timingDebt += delayMs - (correct ? targetInterval : 0);
      return { delayMs, correct };
    },
  };
}

export function simulateBot(options: BotOptions & { text: string }): BotSimulation {
  const runner = createBotRunner(options);
  const result: BotSimulation = {
    keystrokes: [], totalMs: 0, correctChars: 0, typedChars: 0, errors: 0,
  };
  let position = 0;
  while (position < options.text.length) {
    const stroke = runner.next(options.text, position);
    if (stroke === null) break;
    result.totalMs += stroke.delayMs;
    result.typedChars++;
    if (stroke.correct) result.correctChars++;
    else result.errors++;
    if (stroke.correct || options.errorMode === "libre") position++;
    result.keystrokes.push({ ...stroke, atMs: result.totalMs, position });
  }
  return result;
}
