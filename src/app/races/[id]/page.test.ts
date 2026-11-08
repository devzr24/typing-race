import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getMessages } from "@/i18n/server";
import { fr } from "@/i18n/messages/fr";
import { en } from "@/i18n/messages/en";
import RacePage, { generateMetadata } from "./page";

const getSession = vi.hoisted(() => vi.fn<() => Promise<Session | null>>());
vi.mock("@/auth", () => ({ auth: getSession }));
vi.mock("@/lib/prisma", () => ({ prisma: { race: { findFirst: vi.fn() } } }));
vi.mock("@/i18n/server", () => ({ getMessages: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
vi.mock("@/components/race-results", () => ({ RaceResults: vi.fn() }));

const session = { user: { id: "user", username: "runner", isGuest: false }, expires: "2099-01-01" };
const params = () => ({ params: Promise.resolve({ id: "race" }), searchParams: Promise.resolve({}) });

beforeEach(() => {
  vi.resetAllMocks();
  getSession.mockResolvedValue(session);
  vi.mocked(getMessages).mockResolvedValue(fr);
});

describe("accès aux résultats persistés", () => {
  it.each([null, { ...session, user: { ...session.user, isGuest: true } }])("renvoie 404 sans inscrit authentifié", async (value) => {
    getSession.mockResolvedValue(value);
    await expect(RacePage(params())).rejects.toThrow("404");
    expect(prisma.race.findFirst).not.toHaveBeenCalled();
  });
  it("renvoie 404 pour une course inexistante ou dont l'inscrit n'est pas coureur", async () => {
    vi.mocked(prisma.race.findFirst).mockResolvedValue(null);
    await expect(RacePage(params())).rejects.toThrow("404");
    expect(prisma.race.findFirst).toHaveBeenCalledWith({
      where: { id: "race", results: { some: { userId: "user" } } },
      include: { results: { orderBy: { rank: "asc" } } },
    });
  });
  it("reconstruit le classement complet sans transmettre les userId", async () => {
    const base = {
      raceId: "race", image: null, rank: 1, wpm: 50, rawWpm: 55, accuracy: 98, errors: 2,
      timeMs: 60_000, outcome: "TERMINE", wpmSeries: [{ t: 1000, mpm: 30 }], missedKeys: { a: 2 },
      bonuses: [], isPersonalBest: true, createdAt: new Date(0),
    };
    vi.mocked(prisma.race.findFirst).mockResolvedValue({
      id: "race", roomCode: "ABCDEF", text: "test", config: {}, startedAt: new Date(0), endedAt: new Date(60_000),
      results: [
        { ...base, id: "result", userId: "user", displayName: "Runner", kind: "UTILISATEUR" },
        { ...base, id: "bot", userId: null, displayName: "Bot", kind: "BOT", rank: 2, isPersonalBest: false },
        { ...base, id: "guest", userId: null, displayName: "Guest", kind: "INVITE", rank: 3, outcome: "ABANDON", timeMs: null, isPersonalBest: false },
      ],
    } as unknown as Awaited<ReturnType<typeof prisma.race.findFirst>>);
    const element = await RacePage(params());
    const props = element.props.children.props;
    expect(props.selfId).toBe("result");
    expect(props.selectable).toBe(true);
    expect(props.results).toMatchObject([
      { name: "Runner", raceId: "race", netMpm: 50, grossMpm: 55, status: "finished", isPersonalBest: true, series: base.wpmSeries, missedKeys: base.missedKeys },
      { name: "Bot", isBot: true },
      { name: "Guest", isBot: false, status: "abandoned", elapsedMs: undefined },
    ]);
    expect(JSON.stringify(props)).not.toContain("userId");
  });
  it.each([fr, en])("traduit les métadonnées", async (m) => {
    vi.mocked(getMessages).mockResolvedValue(m);
    expect(await generateMetadata()).toEqual({ title: `${m.room.results} — ${m.app.name}` });
  });
});
