import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { DEMO_PASSWORD, loadSeedData } from "../../prisma/corpus/load";
import { passagesFR } from "../../prisma/corpus/passages-fr";

type SeedRace = Omit<Prisma.RaceCreateInput, "results"> & {
  results: { create: Prisma.RaceResultUncheckedCreateWithoutRaceInput[] };
};

vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "hashed-demo-password") }));

beforeEach(() => vi.clearAllMocks());

describe("loadSeedData", () => {
  it.each([null, "demo", "demo2"])("charge deux fois sans doublon et préserve les comptes (historique : %s)", async (historyOwner) => {
    const passages = new Map<string, Prisma.PassageCreateInput>();
    const words = new Map<string, Prisma.WordCreateManyInput>();
    const users = new Map<string, Prisma.UserCreateManyInput>([
      ["demo", { id: "existing-user", username: "demo", name: "Existant", passwordHash: "existing-hash" }],
    ]);
    const existing = { ...users.get("demo") };
    const races: SeedRace[] = [];
    const client = {
      passage: {
        upsert: vi.fn(async ({ create }: { create: Prisma.PassageCreateInput }) => {
          passages.set(create.slug, create);
        }),
      },
      word: {
        createMany: vi.fn(async ({ data, skipDuplicates }: { data: Prisma.WordCreateManyInput[]; skipDuplicates: boolean }) => {
          expect(skipDuplicates).toBe(true);
          for (const word of data) {
            const key = `${word.language}:${word.value}`;
            if (!words.has(key)) words.set(key, word);
          }
        }),
      },
      user: {
        findUnique: vi.fn(async ({ where }: { where: { username: string } }) => users.get(where.username) ?? null),
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { username: string } }) => users.get(where.username)!),
        createMany: vi.fn(async ({ data, skipDuplicates }: { data: Prisma.UserCreateManyInput[]; skipDuplicates: boolean }) => {
          expect(skipDuplicates).toBe(true);
          for (const user of data) {
            if (!users.has(user.username)) users.set(user.username, { ...user, id: `user-${user.username}` });
          }
        }),
      },
      raceResult: { findFirst: vi.fn(async () => historyOwner || races.length ? { id: "existing-result" } : null) },
      race: { create: vi.fn(async ({ data }: { data: SeedRace }) => { races.push(data); }) },
      $transaction: vi.fn(async (write: (tx: unknown) => Promise<void>) => write(client)),
    };

    // Le faux client n'implémente que les opérations réellement utilisées par le seed.
    const prisma = client as unknown as Parameters<typeof loadSeedData>[0];
    await loadSeedData(prisma);
    expect(races).toHaveLength(historyOwner ? 0 : 12);
    await loadSeedData(prisma);
    expect(races).toHaveLength(historyOwner ? 0 : 12);
    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(client.raceResult.findFirst).toHaveBeenCalledWith({
      where: { userId: { in: ["existing-user", "user-demo2"] } }, select: { id: true },
    });

    expect(passages.size).toBe(40);
    expect(words.size).toBe(2000);
    expect(users.size).toBe(2);
    expect(users.get("demo")).toEqual(existing);
    expect(users.get("demo2")).toMatchObject({ username: "demo2", passwordHash: "hashed-demo-password" });
    expect(hashPassword).toHaveBeenCalledExactlyOnceWith(DEMO_PASSWORD);
    expect(client.user.createMany).toHaveBeenCalledTimes(1);
    for (const language of ["FR", "EN"]) {
      expect([...words.values()].filter((word) => word.language === language).map((word) => word.frequencyRank))
        .toEqual(Array.from({ length: 1000 }, (_, index) => index + 1));
    }
    const bests = new Map<string, number>();
    const winners = new Set<string>();
    const outcomes = new Set<string>();
    for (const [index, race] of races.entries()) {
      expect(passagesFR.some((passage) => passage.content === race.text)).toBe(true);
      const start = new Date(race.startedAt).getTime();
      const end = new Date(race.endedAt).getTime();
      expect(start).toBeGreaterThan(Date.now() - 30 * 86_400_000);
      expect(end).toBeLessThan(Date.now());
      if (index > 0) expect(start).toBeGreaterThan(new Date(races[index - 1].startedAt).getTime());
      const results = race.results.create;
      expect(results.filter((result) => result.kind === "UTILISATEUR").map((result) => result.userId).sort())
        .toEqual(["existing-user", "user-demo2"]);
      expect(results.filter((result) => result.kind === "BOT")).toHaveLength(1 + index % 2);
      expect(results.map((result) => result.rank)).toEqual(results.map((_, rank) => rank + 1));
      const order = { TERMINE: 0, TEMPS_ECOULE: 1, ABANDON: 2 };
      for (const [resultIndex, result] of results.entries()) {
        outcomes.add(result.outcome);
        expect(result.timeMs).toBeGreaterThan(0);
        expect(end - start).toBeGreaterThanOrEqual(result.timeMs!);
        expect(result.rawWpm).toBeGreaterThan(result.wpm);
        expect(result.accuracy).toBeGreaterThan(85);
        const series = result.wpmSeries as { t: number; mpm: number }[];
        expect(series.length).toBeGreaterThan(1);
        expect(series.at(-1)!.t).toBeLessThanOrEqual(result.timeMs!);
        expect(series.every((point) => point.mpm > 0 && point.mpm < 100)).toBe(true);
        expect(Object.values(result.missedKeys as Record<string, number>).reduce((sum, count) => sum + count, 0))
          .toBe(result.errors);
        expect(result.bonuses).toEqual([]);
        if (resultIndex > 0) {
          const previous = results[resultIndex - 1];
          expect(order[result.outcome]).toBeGreaterThanOrEqual(order[previous.outcome]);
          if (result.outcome === "TERMINE" && previous.outcome === "TERMINE") {
            expect(result.timeMs).toBeGreaterThanOrEqual(previous.timeMs!);
          }
        }
        const best = result.userId ? bests.get(result.userId) : undefined;
        expect(result.isPersonalBest).toBe(result.outcome === "TERMINE" && best != null && result.wpm > best);
        if (result.kind === "BOT") expect(result.userId).toBeNull();
        if (result.userId && result.outcome === "TERMINE") {
          bests.set(result.userId, Math.max(best ?? 0, result.wpm));
          if (result.rank === 1) winners.add(result.userId);
        }
      }
    }
    if (!historyOwner) {
      expect(winners).toEqual(new Set(["existing-user", "user-demo2"]));
      expect(outcomes).toEqual(new Set(["TERMINE", "TEMPS_ECOULE", "ABANDON"]));
      for (const id of ["existing-user", "user-demo2"]) {
        const first = races[0].results.create.find((result) => result.userId === id)!;
        expect(bests.get(id)).toBeGreaterThan(first.wpm);
      }
    }
  });

  it("remonte les erreurs de chargement", async () => {
    const error = new Error("Base indisponible");
    const client = { passage: { upsert: vi.fn().mockRejectedValue(error) } };
    await expect(loadSeedData(client as unknown as PrismaClient)).rejects.toBe(error);
  });
});
