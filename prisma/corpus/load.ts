import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { createSeededRandom } from "@/lib/bots/random";
import { accuracy, netMpm } from "@/lib/race/metrics";
import { rankParticipants, type RaceParticipant } from "@/lib/race/ranking";
import { defaultRaceConfig } from "@/lib/rooms/types";
import { passagesFR } from "./passages-fr";
import { passagesEN } from "./passages-en";
import { wordsFR } from "./words-fr";
import { wordsEN } from "./words-en";

// Identifiants publics de démonstration, pour demo et demo2.
export const DEMO_PASSWORD = "TypingRace-demo-2026!";

/** Chargement relançable ; les comptes déjà inscrits ne sont jamais modifiés. */
export async function loadSeedData(client: Pick<PrismaClient, "passage" | "word" | "user" | "$transaction">): Promise<void> {
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

  await client.$transaction(async (tx) => {
    const demo = await tx.user.findUniqueOrThrow({ where: { username: "demo" }, select: { id: true } });
    const demo2 = await tx.user.findUniqueOrThrow({ where: { username: "demo2" }, select: { id: true } });
    // Ne jamais mélanger les données de démonstration à un historique existant.
    if (await tx.raceResult.findFirst({ where: { userId: { in: [demo.id, demo2.id] } }, select: { id: true } })) return;

    const random = createSeededRandom(2026);
    const now = Date.now();
    const bests = new Map<string, number>();
    for (let index = 0; index < 12; index++) {
      const passage = passagesFR[index % passagesFR.length];
      const timeLimitSec = Math.ceil(passage.content.length * 12 / 26) + 15;
      const startedAt = new Date(now - (29 - index * 2.5) * 86_400_000);
      const racers = [
        { id: demo.id, name: "demo", wpm: 36 + index * 2 + (index % 2 ? -3 : 4) },
        { id: demo2.id, name: "demo2", wpm: 35 + index * 2 + (index % 2 ? 5 : -2) },
        { id: "bot-noob", name: "Bot Novice", wpm: 26 + Math.floor(random() * 6) },
        ...(index % 2 ? [{ id: "bot-intermediate", name: "Bot Intermédiaire", wpm: 43 + Math.floor(random() * 8) }] : []),
      ].map((racer, playerIndex) => {
        const status: RaceParticipant["status"] = index === 3 && playerIndex === 0 ? "abandoned"
          : index === 7 && playerIndex === 1 ? "timeout" : "finished";
        const position = status === "finished" ? passage.content.length
          : Math.floor(passage.content.length * (status === "timeout" ? 0.65 : 0.3));
        const timeMs = status === "timeout" ? timeLimitSec * 1000 : Math.round(position * 12_000 / racer.wpm);
        const wpm = netMpm(position, timeMs);
        const errors = 2 + Math.floor(random() * 7);
        const missedKeys: Record<string, number> = {};
        for (let error = 0; error < errors; error++) {
          const key = passage.content[Math.floor(random() * position)];
          missedKeys[key] = (missedKeys[key] ?? 0) + 1;
        }
        const userId = playerIndex < 2 ? racer.id : null;
        const previousBest = userId ? bests.get(userId) : undefined;
        const isPersonalBest = status === "finished" && previousBest != null && wpm > previousBest;
        if (userId && status === "finished") bests.set(userId, Math.max(previousBest ?? 0, wpm));
        return {
          id: racer.id, status, joinedAt: playerIndex, finishMs: status === "finished" ? timeMs : undefined,
          progress: position / passage.content.length,
          data: {
            userId, displayName: racer.name, image: null,
            kind: userId ? "UTILISATEUR" as const : "BOT" as const,
            wpm, rawWpm: netMpm(position + errors, timeMs), accuracy: accuracy(position, position + errors),
            errors, timeMs, outcome: status === "finished" ? "TERMINE" as const
              : status === "timeout" ? "TEMPS_ECOULE" as const : "ABANDON" as const,
            wpmSeries: Array.from({ length: Math.floor(timeMs / 1000) }, (_, second) => ({
              t: (second + 1) * 1000, mpm: Math.round(wpm * (0.85 + random() * 0.25) * 10) / 10,
            })),
            missedKeys, bonuses: [], isPersonalBest, createdAt: startedAt,
          },
        };
      });
      await tx.race.create({ data: {
        roomCode: "DEMO22", text: passage.content,
        config: { ...defaultRaceConfig, wordCount: passage.wordCount, timeLimitSec, bonusesEnabled: false },
        startedAt, endedAt: new Date(startedAt.getTime() + Math.max(...racers.map((racer) => racer.data.timeMs))),
        results: { create: rankParticipants(racers).map(({ data, rank }) => ({ ...data, rank })) },
      } });
    }
    // Deux chargements concurrents ne peuvent pas tous deux valider un historique vide.
  }, { isolationLevel: "Serializable" });
}
