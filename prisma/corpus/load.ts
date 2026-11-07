import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { passagesFR } from "./passages-fr";
import { passagesEN } from "./passages-en";
import { wordsFR } from "./words-fr";
import { wordsEN } from "./words-en";

// Identifiants publics de démonstration, pour demo et demo2.
export const DEMO_PASSWORD = "TypingRace-demo-2026!";

/** Chargement relançable ; les comptes déjà inscrits ne sont jamais modifiés. */
export async function loadSeedData(client: Pick<PrismaClient, "passage" | "word" | "user">): Promise<void> {
  for (const passage of [...passagesFR, ...passagesEN]) {
    await client.passage.upsert({
      where: { slug: passage.slug },
      create: passage,
      update: passage,
    });
  }

  for (const [language, words] of [["FR", wordsFR], ["EN", wordsEN]] as const) {
    await client.word.createMany({
      data: words.map((value, index) => ({ language, value, frequencyRank: index + 1 })),
      skipDuplicates: true,
    });
  }

  for (const username of ["demo", "demo2"]) {
    if (await client.user.findUnique({ where: { username }, select: { id: true } })) continue;
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    // skipDuplicates protège aussi un compte créé entre la lecture et l'insertion.
    await client.user.createMany({
      data: [{ username, name: username, passwordHash }],
      skipDuplicates: true,
    });
  }
}