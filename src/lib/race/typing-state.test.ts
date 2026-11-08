import { describe, expect, it } from "vitest";
import { characterState, committedInput, initialTypingState, predictKeys, reduceTyping, textSegments } from "./typing-state";

const self = { text: "abc def", position: 0, errors: 0, fogUntil: 0 };

describe("découpage du texte en segments", () => {
  it("regroupe le préfixe validé et sépare le curseur du brouillard", () => {
    const prediction = predictKeys(initialTypingState({ ...self, text: "abc def ghi" }).base, "abc d", "CORRECTION");
    expect(textSegments(prediction, true)).toEqual([
      { start: 0, text: "abc d", state: "correct", fogged: false },
      { start: 5, text: "e", state: "current", fogged: false },
      { start: 6, text: "f ", state: "remaining", fogged: false },
      { start: 8, text: "ghi", state: "remaining", fogged: true },
    ]);
    expect(textSegments(prediction, false).at(-1)).toEqual({ start: 6, text: "f ghi", state: "remaining", fogged: false });
  });

  it.each(["CORRECTION", "LIBRE"] as const)("préserve chaque état en mode %s, aux espaces et en fin de texte", (mode) => {
    let prediction = initialTypingState({ ...self, text: "éa  bc\ndef" }).base;
    for (const keys of ["", "x", "é", "x", "a", "  ", "bx", "c\ndef"]) {
      prediction = predictKeys(prediction, keys, mode);
      for (const fogged of [false, true]) {
        const segments = textSegments(prediction, fogged);
        expect(segments.map((segment) => segment.text).join("")).toBe(prediction.text);
        const wordEnd = prediction.text.indexOf(" ", prediction.position);
        const fogStart = wordEnd < 0 ? prediction.text.length : wordEnd + 1;
        const characters = segments.flatMap((segment) => segment.text.split("").map((text, offset) => ({
          text, state: segment.state, fogged: segment.fogged, index: segment.start + offset,
        })));
        expect(characters).toEqual(prediction.text.split("").map((text, index) => ({
          text, state: characterState(index, prediction), fogged: fogged && index >= fogStart, index,
        })));
      }
    }
  });

  it("borne le nombre de segments pour 200 mots, même après une frappe", () => {
    const text = Array(200).fill("bonjour").join(" ");
    const prediction = predictKeys(initialTypingState({ ...self, text }).base, text.slice(0, 700), "CORRECTION");
    expect(textSegments(prediction, false)).toHaveLength(3);
    expect(textSegments(predictKeys(prediction, text[700], "CORRECTION"), false)).toHaveLength(3);
    expect(textSegments(prediction, true)).toHaveLength(4);
    expect(textSegments(initialTypingState({ ...self, text: "" }).base, true)).toEqual([]);
  });
});

describe("prédiction de frappe", () => {
  it("reste sur l'erreur en correction, puis avance sans retour arrière", () => {
    const wrong = predictKeys(initialTypingState(self).base, "ax", "CORRECTION");
    expect(wrong.position).toBe(1);
    expect([0, 1, 2].map((i) => characterState(i, wrong))).toEqual(["correct", "error", "remaining"]);
    const corrected = predictKeys(wrong, "b", "CORRECTION");
    expect(corrected.position).toBe(2);
    expect(corrected.errors).toBe(1);
    expect(characterState(1, corrected)).toBe("correct");
    expect(characterState(2, corrected)).toBe("current");
  });

  it("avance en mode libre et conserve les caractères erronés", () => {
    const prediction = predictKeys(initialTypingState(self).base, "axc", "LIBRE");
    expect(prediction.position).toBe(3);
    expect(prediction.errors).toBe(1);
    expect([0, 1, 2, 3].map((i) => characterState(i, prediction))).toEqual(["correct", "error", "correct", "current"]);
  });

  it("repart de l'ack serveur puis rejoue uniquement les frappes en attente", () => {
    let state = reduceTyping(initialTypingState(self), { type: "keys", keys: "abc" }, "CORRECTION");
    state = reduceTyping(state, { type: "ack", through: 2, response: { ok: true, position: 1, errors: 1 } }, "CORRECTION");
    const prediction = predictKeys(state.base, state.pending, "CORRECTION");
    expect(state.pending).toBe("c");
    expect(prediction.position).toBe(1);
    expect(prediction.errors).toBe(2);
    expect(reduceTyping(state, { type: "ack", through: 2, response: { ok: true, position: 0, errors: 0 } }, "CORRECTION")).toBe(state);
  });

  it("applique un bonus reçu avant l'ack sans compter les frappes deux fois", () => {
    let state = reduceTyping(initialTypingState(self), { type: "keys", keys: "abc " }, "CORRECTION");
    state = reduceTyping(state, { type: "self", self: { ...self, text: "abc def ghi", position: 4, fogUntil: 4000 } }, "CORRECTION");
    expect(predictKeys(state.base, state.pending, "CORRECTION").position).toBe(4);
    state = reduceTyping(state, { type: "ack", through: 4, response: { ok: true, position: 4, errors: 0 } }, "CORRECTION");
    expect(state.base.text).toBe("abc def ghi");
    expect(state.base.fogUntil).toBe(4000);
    expect(state.pending).toBe("");
  });

  it("conserve les frappes refusées pour débit avant leur nouvelle tentative", () => {
    let state = initialTypingState({ ...self, position: 4, errors: 2 });
    state = reduceTyping(state, { type: "keys", keys: "de" }, "CORRECTION");
    state = reduceTyping(state, { type: "ack", through: 2, response: { ok: false, error: "raceTooFast" } }, "CORRECTION");
    expect(state.base.position).toBe(4);
    expect(state.base.errors).toBe(2);
    expect(state.pending).toBe("de");
    expect(state.acknowledged).toBe(0);
    state = reduceTyping(state, { type: "ack", through: 2, response: { ok: true, position: 6, errors: 2 } }, "CORRECTION");
    expect(state.pending).toBe("");
    expect(state.base.position).toBe(6);
  });

  it("attend la fin des accents morts et de la composition IME", () => {
    expect(committedInput("´", true, "insertCompositionText")).toBeNull();
    expect(committedInput("é", true, "insertCompositionText")).toBeNull();
    expect(committedInput("é", false, "insertFromComposition")).toBe("é");
    expect(committedInput("漢", true, "insertCompositionText")).toBeNull();
    expect(committedInput("漢字", false, "insertFromComposition")).toBe("漢字");
    expect(committedInput("a", false, "insertText")).toBe("a");
    expect(committedInput("collé", false, "insertFromPaste")).toBe("");
    expect(committedInput("déposé", false, "insertFromDrop")).toBe("");
  });
});
