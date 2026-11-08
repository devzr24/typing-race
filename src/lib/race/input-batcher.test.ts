import { afterEach, describe, expect, it, vi } from "vitest";
import { createInputBatcher, type InputBatch } from "./input-batcher";

afterEach(() => vi.useRealTimers());

describe("tampon de frappe", () => {
  it("regroupe, découpe à 20 et conserve ordre et séquence", () => {
    vi.useFakeTimers();
    const batches: InputBatch[] = [];
    const batcher = createInputBatcher((batch, acknowledge) => { batches.push(batch); acknowledge(false); }, 42);
    batcher.push("abcdefghij");
    batcher.push("klmnopqrstuvwxyz".repeat(3));
    vi.advanceTimersByTime(124);
    expect(batches).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(batches).toEqual([{ seq: 43, keys: "abcdefghijklmnopqrst" }]);
    vi.advanceTimersByTime(300);
    expect(batches.map((b) => b.keys).join("")).toBe("abcdefghij" + "klmnopqrstuvwxyz".repeat(3));
    expect(batches.every((b) => b.keys.length <= 20)).toBe(true);
    expect(batches.map((b) => b.seq)).toEqual([43, 44, 45]);
    batcher.dispose();
  });

  it("ne dépasse jamais 8 messages par seconde, y compris après une pause", () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const batcher = createInputBatcher((_, acknowledge) => { times.push(Date.now()); acknowledge(false); });
    for (let i = 0; i < 240; i++) {
      batcher.push("a".repeat(5));
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(5000);
    batcher.push("x");
    vi.advanceTimersByTime(1);
    batcher.push("y".repeat(200));
    vi.advanceTimersByTime(1500);
    for (const time of times) expect(times.filter((t) => t >= time && t < time + 1000).length).toBeLessThanOrEqual(8);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(125);
    batcher.dispose();
  });

  it("réessaie raceTooFast sans perte ni désordre malgré la gigue des messages et des acks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    // Le serveur conserve les envois de la connexion précédente dans sa fenêtre glissante.
    let inputTimes = Array.from({ length: 10 }, (_, index) => 990 + index);
    const attempts: InputBatch[] = [];
    const accepted: string[] = [];
    let refusals = 0;
    const batcher = createInputBatcher((batch, acknowledge) => {
      attempts.push(batch);
      const jitter = attempts.length % 2 === 0 ? 15 : 180;
      setTimeout(() => {
        inputTimes = inputTimes.filter((time) => Date.now() - time < 1000);
        const tooFast = inputTimes.length >= 10;
        if (tooFast) refusals++;
        else {
          inputTimes.push(Date.now());
          accepted.push(batch.keys);
        }
        setTimeout(() => acknowledge(tooFast), jitter / 3);
      }, jitter);
    }, 42);
    const keys = "abcdefghijklmnopqrstuvwxyz".repeat(4);
    batcher.push(keys);
    vi.advanceTimersByTime(126);
    batcher.push("é漢字");
    vi.advanceTimersByTime(5000);
    expect(refusals).toBeGreaterThan(0);
    expect(accepted.join("")).toBe(keys + "é漢字");
    expect(attempts[0].keys).toBe(attempts[1].keys);
    expect(attempts.map((batch) => batch.seq)).toEqual(attempts.map((_, index) => 43 + index));
    batcher.dispose();
  });

  it("annule le tampon à la déconnexion ou à l'abandon", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const batcher = createInputBatcher(send);
    batcher.push("abc");
    batcher.dispose();
    batcher.push("def");
    vi.advanceTimersByTime(1000);
    expect(send).not.toHaveBeenCalled();
  });
});
