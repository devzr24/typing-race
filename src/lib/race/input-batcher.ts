import { MAX_CHARACTERS_PER_MESSAGE } from "./metrics";

export type InputBatch = { seq: number; keys: string };

// Un seul paquet par créneau, même si le tampon dépasse 20 caractères.
export function createInputBatcher(send: (batch: InputBatch) => void, initialSequence = 0) {
  let buffer = "";
  let sequence = initialSequence;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let nextSendAt = Date.now() + 100;

  function schedule() {
    if (timer !== undefined || stopped || !buffer) return;
    timer = setTimeout(() => {
      timer = undefined;
      const keys = buffer.slice(0, MAX_CHARACTERS_PER_MESSAGE);
      buffer = buffer.slice(keys.length);
      nextSendAt = Date.now() + 100;
      send({ seq: ++sequence, keys });
      schedule();
    }, Math.max(0, nextSendAt - Date.now()));
  }

  return {
    push(keys: string) {
      if (stopped) return;
      buffer += keys;
      schedule();
    },
    dispose() {
      stopped = true;
      buffer = "";
      clearTimeout(timer);
    },
  };
}
