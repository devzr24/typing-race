import { afterEach, describe, expect, it, vi } from "vitest";
import { createInputBatcher, type InputBatch } from "./input-batcher";

afterEach(() => vi.useRealTimers());

describe("tampon de frappe", () => {
  it("regroupe, découpe à 20 et conserve ordre et séquence", () => {
    vi.useFakeTimers();
    const batches: InputBatch[] = [];
    const batcher = createInputBatcher((batch) => batches.push(batch), 42);
    batcher.push("abcdefghij");
    batcher.push("klmnopqrstuvwxyz".repeat(3));
    vi.advanceTimersByTime(99);
    expect(batches).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(batches).toEqual([{ seq: 43, keys: "abcdefghijklmnopqrst" }]);
    vi.advanceTimersByTime(300);
    expect(batches.map((b) => b.keys).join("")).toBe("abcdefghij" + "klmnopqrstuvwxyz".repeat(3));
    expect(batches.every((b) => b.keys.length <= 20)).toBe(true);
    expect(batches.map((b) => b.seq)).toEqual([43, 44, 45]);
    batcher.dispose();
  });

  it("ne dépasse jamais 10 messages par seconde, y compris après une pause", () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const batcher = createInputBatcher(() => times.push(Date.now()));
    for (let i = 0; i < 240; i++) {
      batcher.push("a".repeat(5));
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(5000);
    batcher.push("x");
    vi.advanceTimersByTime(1);
    batcher.push("y".repeat(200));
    vi.advanceTimersByTime(1500);
    for (const time of times) expect(times.filter((t) => t >= time && t < time + 1000).length).toBeLessThanOrEqual(10);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(100);
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
