import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { DEMO_PASSWORD, loadSeedData } from "../../prisma/corpus/load";

vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "hashed-demo-password") }));

beforeEach(() => vi.clearAllMocks());

describe("loadSeedData", () => {
  it("charge deux fois sans doublon et préserve un compte existant", async () => {
    const passages = new Map<string, Prisma.PassageCreateInput>();
    const words = new Map<string, Prisma.WordCreateManyInput>();
    const users = new Map<string, Prisma.UserCreateManyInput>([
      ["demo", { id: "existing-user", username: "demo", name: "Existant", passwordHash: "existing-hash" }],
    ]);
    const existing = { ...users.get("demo") };
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
        createMany: vi.fn(async ({ data, skipDuplicates }: { data: Prisma.UserCreateManyInput[]; skipDuplicates: boolean }) => {
          expect(skipDuplicates).toBe(true);
          for (const user of data) {
            if (!users.has(user.username)) users.set(user.username, user);
          }
        }),
      },
    };

    // Le faux client n'implémente que les opérations réellement utilisées par le seed.
    const prisma = client as unknown as Pick<PrismaClient, "passage" | "word" | "user">;
    await loadSeedData(prisma);
    await loadSeedData(prisma);

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
  });

  it("remonte les erreurs de chargement", async () => {
    const error = new Error("Base indisponible");
    const client = { passage: { upsert: vi.fn().mockRejectedValue(error) } };
    await expect(loadSeedData(client as unknown as PrismaClient)).rejects.toBe(error);
  });
});