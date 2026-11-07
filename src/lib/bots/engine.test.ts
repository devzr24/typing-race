import { describe, expect, it } from "vitest";
import { BOT_LEVELS, type BotLevel } from "./levels";
import { createBotRunner, simulateBot, type ErrorMode } from "./engine";

const levels = Object.keys(BOT_LEVELS) as BotLevel[];
const modes: ErrorMode[] = ["correction", "libre"];
const longText = (
  "le petit chat avance dans la cour puis retrouve ses amis pour jouer " +
  "ensemble. Demain, 2026 élèves découvriront des énigmes extraordinaires ! "
).repeat(100);

describe("niveaux", () => {
  it("exporte les cinq plages et taux demandés", () => {
    expect(BOT_LEVELS).toEqual({
      noob: { minWpm: 10, maxWpm: 20, errorRate: 0.12 },
      beginner: { minWpm: 20, maxWpm: 35, errorRate: 0.08 },
      intermediate: { minWpm: 35, maxWpm: 60, errorRate: 0.05 },
      expert: { minWpm: 70, maxWpm: 100, errorRate: 0.02 },
      impossible: { minWpm: 140, maxWpm: 170, errorRate: 0.005 },
    });
  });
});

describe("simulateBot", () => {
  it.each(modes)("est déterministe en mode %s et dépend de la graine", (errorMode) => {
    const options = { level: "noob" as const, seed: 42, errorMode, text: longText.slice(0, 500) };
    expect(simulateBot(options)).toEqual(simulateBot(options));
    expect(simulateBot(options).keystrokes).not.toEqual(
      simulateBot({ ...options, seed: 43 }).keystrokes,
    );
  });

  it.each(levels.flatMap((level) => modes.map((errorMode) => ({ level, errorMode }))))(
    "respecte les MPM nets et le taux d'erreur : $level / $errorMode",
    ({ level, errorMode }) => {
      const config = BOT_LEVELS[level];
      let errors = 0;
      let typed = 0;
      for (const length of [200, 250, 300]) {
        let inRange = 0;
        for (let seed = 0; seed < 200; seed++) {
          const race = simulateBot({ level, errorMode, seed, text: longText.slice(0, length) });
          const wpm = race.correctChars / 5 / (race.totalMs / 60000);
          if (wpm >= config.minWpm && wpm <= config.maxWpm) inRange++;
          expect(wpm).toBeGreaterThanOrEqual(config.minWpm * 0.9);
          errors += race.errors;
          typed += race.typedChars;
        }
        expect(inRange / 200).toBeGreaterThanOrEqual(0.98);
      }
      // ±10 % relatifs ou 0,15 point pour les taux rares.
      expect(Math.abs(errors / typed - config.errorRate)).toBeLessThan(
        Math.max(0.0015, config.errorRate * 0.1),
      );
    },
  );

  it("corrige chaque erreur sans avancer et termine avec tous les caractères validés", () => {
    const text = "un chat et deux amis ".repeat(50);
    const race = simulateBot({ level: "noob", seed: 42, errorMode: "correction", text });
    let position = 0;
    let atMs = 0;
    for (const [index, stroke] of race.keystrokes.entries()) {
      expect(stroke.delayMs).toBeGreaterThan(0);
      atMs += stroke.delayMs;
      expect(stroke.atMs).toBe(atMs);
      if (stroke.correct) position++;
      else {
        const corrected = race.keystrokes[index + 1];
        expect(corrected.correct).toBe(true);
        expect(corrected.delayMs).toBeGreaterThan(stroke.delayMs);
        expect(corrected.position).toBe(position + 1);
      }
      expect(stroke.position).toBe(position);
    }
    expect(race.errors).toBeGreaterThan(0);
    expect(position).toBe(text.length);
    expect(race.correctChars).toBe(text.length);
    expect(race.typedChars).toBe(text.length + race.errors);
    expect(race.totalMs).toBe(atMs);
  });

  it("avance aussi sur les erreurs libres et les exclut des caractères corrects", () => {
    const race = simulateBot({ level: "noob", seed: 42, errorMode: "libre", text: longText });
    expect(race.errors).toBeGreaterThan(0);
    expect(race.typedChars).toBe(longText.length);
    expect(race.correctChars).toBe(longText.length - race.errors);
    expect(race.keystrokes.every((stroke, index) => stroke.position === index + 1)).toBe(true);
  });

  it("ajoute au moins 1,5 intervalle de l'erreur pour la correction", () => {
    const race = simulateBot({ level: "noob", seed: 42, errorMode: "correction", text: "a".repeat(250) });
    let checked = 0;
    for (let index = 1; index < race.keystrokes.length; index++) {
      const stroke = race.keystrokes[index];
      if (stroke.correct) continue;
      // Sans pause : délai de l'erreur <= 1,08 intervalle (jitter maximal).
      expect(race.keystrokes[index + 1].delayMs - stroke.delayMs)
        .toBeGreaterThanOrEqual(1.5 * stroke.delayMs / 1.08);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("fait aussi coûter du temps aux erreurs libres", () => {
    const race = simulateBot({ level: "noob", seed: 42, errorMode: "libre", text: "a".repeat(300) });
    // Un seul mot : même rythme, hors pause initiale ; le retard reste compensé.
    const strokes = race.keystrokes.slice(1);
    const errors = strokes.filter((stroke) => !stroke.correct);
    const correct = strokes.filter((stroke) => stroke.correct);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.reduce((sum, stroke) => sum + stroke.delayMs, 0) / errors.length).toBeGreaterThan(
      correct.reduce((sum, stroke) => sum + stroke.delayMs, 0) / correct.length * 1.3,
    );
  });

  it("simule un texte vide sans frappe ni délai", () => {
    expect(simulateBot({ level: "expert", seed: 0, errorMode: "libre", text: "" })).toEqual({
      keystrokes: [], totalMs: 0, correctChars: 0, typedChars: 0, errors: 0,
    });
  });

  it.each(levels)("fait varier nettement la vitesse des mots : %s", (level) => {
    const text = "simple ".repeat(200);
    const race = simulateBot({ level, seed: 42, errorMode: "libre", text });
    const speeds = Array.from({ length: 200 }, (_, index) => {
      const duration = race.keystrokes.slice(index * 7, index * 7 + 7)
        .reduce((sum, stroke) => sum + stroke.delayMs, 0);
      return 7 / 5 / (duration / 60000);
    });
    const mean = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    const deviation = Math.sqrt(speeds.reduce((sum, speed) => sum + (speed - mean) ** 2, 0) / speeds.length);
    expect(deviation / mean).toBeGreaterThan(0.03);
  });
});

describe("createBotRunner", () => {
  it.each(["abcdefghijklmnop", "abcdef!", "abc123", "ABCDEF", "abcdéf"])(
    "ralentit sur le mot difficile %s",
    (word) => {
      let easyDelay = 0;
      let hardDelay = 0;
      for (let seed = 0; seed < 40; seed++) {
        const options = { level: "expert" as const, seed, errorMode: "libre" as const };
        easyDelay += createBotRunner(options).next("abcdef", 0)!.delayMs;
        hardDelay += createBotRunner(options).next(word, 0)!.delayMs;
      }
      expect(hardDelay).toBeGreaterThan(easyDelay * 1.02);
    },
  );

  it.each(modes)("accepte +3 puis −3 mots pendant la course en mode %s", (errorMode) => {
    const options = { level: "noob" as const, seed: 42, errorMode };
    const runner = createBotRunner(options);
    const replay = createBotRunner(options);
    let text = "un chat joue avec ses amis";
    let position = 0;
    let calls = 0;
    while (position < text.length) {
      if (calls === 3) text += " dans la cour";
      if (calls === 10) text = text.slice(0, text.lastIndexOf(" dans"));
      const stroke = runner.next(text, position)!;
      expect(stroke).toEqual(replay.next(text, position));
      expect(Number.isFinite(stroke.delayMs)).toBe(true);
      if (stroke.correct || errorMode === "libre") position++;
      calls++;
    }
    expect(calls).toBeGreaterThan(10);
    expect(position).toBe(text.length);
  });

  it("relit un mot modifié et ignore le suffixe tant qu'il n'est pas atteint", () => {
    const options = { level: "expert" as const, seed: 42, errorMode: "libre" as const };
    const first = createBotRunner(options);
    const second = createBotRunner(options);
    expect(first.next("simple chat", 0)).toEqual(second.next("simple supplément", 0));
    expect(first.next("SIMPLE123é! chat", 1)).not.toEqual(second.next("simple chat", 1));
  });

  it("signale la fin, même après raccourcissement, puis reprend si le texte est allongé", () => {
    const runner = createBotRunner({ level: "expert", seed: 0, errorMode: "libre" });
    expect(runner.next("", 0)).toBeNull();
    runner.next("a", 0);
    expect(runner.next("a", 1)).toBeNull();
    expect(runner.next("", 1)).toBeNull();
    expect(runner.next("a b c d", 1)!.delayMs).toBeGreaterThan(0);
    for (const position of [-1, 0.5, NaN, Infinity]) {
      expect(() => runner.next("a", position)).toThrow(RangeError);
    }
  });
});
