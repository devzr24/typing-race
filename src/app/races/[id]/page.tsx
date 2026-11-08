import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { RaceResults } from "@/components/race-results";
import { getMessages } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import type { ResultRow } from "@/lib/race/results-visuals";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.room.results} — ${m.app.name}` };
}

export default async function RacePage({ params }: PageProps<"/races/[id]">) {
  const session = await auth();
  if (!session?.user || session.user.isGuest) notFound();
  const { id } = await params;
  const race = await prisma.race.findFirst({
    where: { id, results: { some: { userId: session.user.id } } },
    include: { results: { orderBy: { rank: "asc" } } },
  });
  if (!race) notFound();
  const outcomes = { TERMINE: "finished", TEMPS_ECOULE: "timeout", ABANDON: "abandoned" } as const;
  const results: ResultRow[] = race.results.map((r) => ({
    id: r.id, raceId: race.id, name: r.displayName, image: r.image, isBot: r.kind === "BOT",
    rank: r.rank, netMpm: r.wpm, grossMpm: r.rawWpm, accuracy: r.accuracy, errors: r.errors,
    elapsedMs: r.timeMs ?? undefined, status: outcomes[r.outcome], isPersonalBest: r.isPersonalBest,
    series: r.wpmSeries as ResultRow["series"], missedKeys: r.missedKeys as ResultRow["missedKeys"],
    bonuses: r.bonuses as ResultRow["bonuses"],
  }));
  const selfId = race.results.find((r) => r.userId === session.user.id)?.id;
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
    <RaceResults results={results} selfId={selfId} selectable />
  </main>;
}
