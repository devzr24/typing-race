import type { RaceSelf } from "./engine";
import type { RaceConfig } from "@/lib/rooms/types";
import type { RaceInputResponse } from "@/lib/rooms/events";

type ErrorMode = RaceConfig["errorMode"];

export function committedInput(value: string, composing: boolean, inputType: string): string | null {
  if (composing) return null;
  return inputType === "insertFromPaste" || inputType === "insertFromDrop" ? "" : value;
}
export type Prediction = RaceSelf & { currentError: boolean; wrongPositions: number[] };
export type TypingState = { base: Prediction; pending: string; acknowledged: number };
export type TypingAction =
  | { type: "keys"; keys: string }
  | { type: "self"; self: RaceSelf }
  | { type: "ack"; through: number; response: RaceInputResponse };

export function predictKeys(base: Prediction, keys: string, mode: ErrorMode): Prediction {
  const next = { ...base, wrongPositions: [...base.wrongPositions] };
  for (let i = 0; i < keys.length && next.position < next.text.length; i++) {
    const correct = keys[i] === next.text[next.position];
    next.currentError = !correct;
    if (!correct) next.errors++;
    if (correct || mode === "LIBRE") {
      if (!correct) next.wrongPositions.push(next.position);
      next.position++;
      next.currentError = false;
    }
  }
  return next;
}

export function initialTypingState(self: RaceSelf): TypingState {
  return { base: { ...self, currentError: false, wrongPositions: [] }, pending: "", acknowledged: 0 };
}

export function reduceTyping(state: TypingState, action: TypingAction, mode: ErrorMode): TypingState {
  if (action.type === "keys") return { ...state, pending: state.pending + action.keys };
  if (action.type === "self") {
    // Un bonus peut arriver avant l'ack du paquet qui l'a déclenché.
    // Le texte change immédiatement ; l'ack retire ensuite les frappes traitées.
    return { ...state, base: { ...state.base, ...action.self,
      ...(state.pending ? { position: state.base.position, errors: state.base.errors } : {}),
    } };
  }
  if (action.through <= state.acknowledged) return state;
  if (!action.response.ok && action.response.error === "raceTooFast") return state;
  const count = action.through - state.acknowledged;
  let base = state.base;
  if (action.response.ok) {
    const { position, errors } = action.response;
    const predicted = predictKeys(base, state.pending.slice(0, count), mode);
    base = { ...predicted, position, errors,
      currentError: predicted.position === position && predicted.currentError,
      wrongPositions: predicted.wrongPositions.filter((p) => p < position),
    };
  }
  return { base, pending: state.pending.slice(count), acknowledged: action.through };
}

export function characterState(index: number, prediction: Prediction): "correct" | "error" | "current" | "remaining" {
  if (index < prediction.position) return prediction.wrongPositions.includes(index) ? "error" : "correct";
  if (index === prediction.position) return prediction.currentError ? "error" : "current";
  return "remaining";
}
