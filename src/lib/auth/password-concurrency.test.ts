import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword, ScryptQueueFullError, verifyPassword } from "./password";

const state = vi.hoisted(() => ({
  active: 0,
  maximum: 0,
  pending: [] as Array<(error?: Error) => void>,
}));

vi.mock("node:crypto", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:crypto")>(),
  scrypt: (...args: unknown[]) => {
    state.active++;
    state.maximum = Math.max(state.maximum, state.active);
    const callback = args.at(-1) as (error: Error | null, key: Buffer) => void;
    state.pending.push((error) => {
      state.active--;
      callback(error ?? null, Buffer.alloc(64));
    });
  },
}));

async function finishNext(error?: Error) {
  state.pending.shift()!(error);
  // Laisse la place libérée être reprise par le prochain calcul en attente.
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  state.active = 0;
  state.maximum = 0;
  state.pending = [];
});

describe("plafond scrypt", () => {
  it("partage deux places entre hachage et vérification, avec huit places en attente", async () => {
    const stored = `scrypt$131072$8$1$c2Vs$${Buffer.alloc(64).toString("base64")}`;
    const jobs = Array.from({ length: 10 }, (_, i) =>
      i % 2 ? verifyPassword("motdepasse", stored) : hashPassword("motdepasse"));
    expect(state.active).toBe(2);
    for (let i = 0; i < 10; i++) await finishNext();
    await Promise.all(jobs);
    expect(state.maximum).toBe(2);
    expect(state.active).toBe(0);
  });

  it("rejette immédiatement quand les huit places d'attente sont occupées", async () => {
    const jobs = Array.from({ length: 10 }, () => hashPassword("motdepasse"));
    await expect(hashPassword("en-trop")).rejects.toBeInstanceOf(ScryptQueueFullError);
    expect(state.active).toBe(2);
    for (let i = 0; i < 10; i++) await finishNext();
    await Promise.all(jobs);
  });

  it("libère aussi la place après un échec scrypt", async () => {
    const failed = hashPassword("motdepasse");
    const rejection = expect(failed).rejects.toThrow("échec scrypt");
    const jobs = [hashPassword("deuxieme"), hashPassword("troisieme")];
    await finishNext(new Error("échec scrypt"));
    await rejection;
    await finishNext();
    await finishNext();
    await Promise.all(jobs);
    expect(state.active).toBe(0);
    expect(state.maximum).toBe(2);
  });
});
