import { describe, expect, it } from "vitest";
import { defaultRaceConfig, type Room } from "@/lib/rooms/types";
import {
  abandon, applyKeys, createRaceState, finalResults, isOver, racerProgress,
  sampleSeries, timeoutRemaining, type RaceState,
} from "./engine";
import { FOG_DURATION_MS } from "./bonus";

const room: Room = {
  code: "ABCDEF", status: "EN_COURSE", hostKey: "secret", createdAt: new Date(0),
  capacity: 8, visibility: "PUBLIQUE", invites: [], bannedKeys: [],
  participants: [{ id: "human", key: "secret", displayName: "Human", image: null, isGuest: false, isSpectator: false, joinedAt: new Date(0) }],
  bots: [{ id: "bot", name: "Bot", level: "EXPERT" }],
  config: { ...defaultRaceConfig, bonusesEnabled: false },
};
const create = (text = "abc", config = {}, seed = 0) => createRaceState({ ...room, config: { ...room.config, ...config } }, text, 1000, seed);

function typeUntil(state: RaceState, id: string, position: number) {
  const racer = state.racers.find((r) => r.id === id)!;
  while (racer.position < Math.min(position, racer.text.length)) {
    const result = applyKeys(state, id, racer.text.slice(racer.position, Math.min(position, racer.position + 20)), 61_000);
    expect(result.ok).toBe(true);
  }
}

describe("frappes validées par le moteur", () => {
  it("en correction, compte chaque erreur sans avancer et retient la touche attendue", () => {
    const state = create();
    expect(applyKeys(state, "human", "axc", 2000)).toMatchObject({ ok: true, position: 1, errors: 2 });
    expect(state.racers[0]).toMatchObject({ totalKeystrokes: 3, correctKeystrokes: 1, missedKeys: { b: 2 } });
  });
  it("en libre, avance aussi sur une faute et termine", () => {
    const state = create("abc", { errorMode: "LIBRE" });
    expect(applyKeys(state, "bot", "axc", 3000)).toMatchObject({ ok: true, position: 3, errors: 1 });
    expect(state.racers[1]).toMatchObject({ status: "finished", finishMs: 2000, totalKeystrokes: 3, correctKeystrokes: 2, missedKeys: { b: 1 } });
  });
  it("utilise les unités UTF-16 même pour une paire de substituts", () => {
    const state = create("😀a");
    applyKeys(state, "human", "😀", 2000);
    expect(state.racers[0].position).toBe(2);
    applyKeys(state, "human", "a", 2000);
    expect(state.racers[0].status).toBe("finished");
  });
  it("rejette avant le départ, un inconnu et un coureur arrivé", () => {
    const state = create();
    expect(applyKeys(state, "human", "a", 999)).toEqual({ ok: false, error: "raceNotStarted" });
    expect(applyKeys(state, "unknown", "a", 2000)).toEqual({ ok: false, error: "raceNotRacing" });
    applyKeys(state, "human", "abc", 2000);
    expect(applyKeys(state, "human", "a", 2001)).toEqual({ ok: false, error: "raceNotRacing" });
  });
  it("rejette plus de 20 caractères sans aucune mutation", () => {
    const state = create("a".repeat(100));
    const before = structuredClone(state);
    expect(applyKeys(state, "human", "a".repeat(21), 2000)).toEqual({ ok: false, error: "raceInputInvalid" });
    expect(state).toEqual(before);
  });
  it("rejette atomiquement une vitesse invraisemblable", () => {
    const state = create("a".repeat(100));
    applyKeys(state, "human", "a".repeat(20), 1001);
    const before = structuredClone(state);
    expect(applyKeys(state, "human", "xaa", 1002)).toEqual({ ok: false, error: "raceImplausible" });
    expect(state).toEqual(before);
  });
  it("exclut les spectateurs", () => {
    const state = createRaceState({ ...room, participants: room.participants.map((p) => ({ ...p, isSpectator: true })) }, "abc", 0, 0);
    expect(state.racers.map((r) => r.id)).toEqual(["bot"]);
  });
});

describe("fin et statistiques", () => {
  it("fige la progression et les métriques à l'abandon", () => {
    const state = create("abcdefghij");
    applyKeys(state, "human", "abc", 2000);
    expect(abandon(state, "human", 3000)).toBe(true);
    const racer = state.racers[0];
    racer.text += " more words";
    expect(racerProgress(racer)).toBe(0.3);
    expect(abandon(state, "human", 4000)).toBe(false);
    timeoutRemaining(state, 5000);
    expect(finalResults(state).find((r) => r.id === "human")).toMatchObject({ status: "abandoned", progress: 0.3, elapsedMs: 2000, netMpm: 18 });
    expect(isOver(state)).toBe(true);
  });
  it("classe les arrivés avant les timeout puis les abandons avec les statistiques", () => {
    const state = create("abc", { timeLimitSec: 30 });
    state.racers.push({ ...state.racers[1], id: "third" });
    applyKeys(state, "human", "xbc", 2000);
    applyKeys(state, "human", "abc", 3000);
    applyKeys(state, "bot", "a", 4000);
    applyKeys(state, "third", "ab", 4000);
    abandon(state, "third", 5000);
    expect(isOver(state)).toBe(false);
    timeoutRemaining(state);
    const results = finalResults(state);
    expect(results.map((r) => [r.id, r.status, r.rank])).toEqual([
      ["human", "finished", 1], ["bot", "timeout", 2], ["third", "abandoned", 3],
    ]);
    expect(results[0]).toMatchObject({ netMpm: 18, grossMpm: 36, accuracy: 50, errors: 3, finishMs: 2000, missedKeys: { a: 3 } });
    expect(results[1].elapsedMs).toBe(30_000);
    expect(JSON.stringify(results)).not.toContain("secret");
  });
  it("échantillonne au plus une fois par seconde et seulement les actifs", () => {
    const state = create("abcdef");
    applyKeys(state, "human", "a", 1500);
    sampleSeries(state, 1999);
    sampleSeries(state, 2000);
    sampleSeries(state, 2500);
    abandon(state, "human", 2600);
    sampleSeries(state, 3000);
    expect(state.racers[0].series).toEqual([{ t: 1000, mpm: 12 }]);
    expect(state.racers[1].series.map((p) => p.t)).toEqual([1000, 2000]);
  });
});

describe("bonus sur les humains et les bots", () => {
  const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
  it.each(["human", "bot"])("applique les trois types de bonus quand %s mène", (leaderId) => {
    for (const [seed, type] of [[0, "plus3"], [1, "minus3"], [2, "fog"]] as const) {
      const state = create(text, { bonusesEnabled: true }, seed);
      const leader = state.racers.find((r) => r.id === leaderId)!;
      const lagger = state.racers.find((r) => r.id !== leaderId)!;
      typeUntil(state, leaderId, Math.ceil(text.length * 0.3));
      expect(lagger.bonuses).toHaveLength(1);
      expect(lagger.bonuses[0]).toMatchObject({ type, checkpoint: 0.25, playerId: lagger.id, atMs: 60_000 });
      if (type === "minus3") expect(lagger.text.split(" ")).toHaveLength(37);
      if (type === "plus3") {
        expect(leader.text.split(" ")).toHaveLength(43);
        expect(leader.text.startsWith(text)).toBe(true);
        expect(leader.text.slice(text.length).trim().split(" ").every((word) => text.split(" ").includes(word))).toBe(true);
      }
      if (type === "fog") expect(leader.fogUntil).toBe(61_000 + FOG_DURATION_MS);
    }
  });
  it("utilise chaque checkpoint une fois, au plus trois bonus par joueur, de manière déterministe", () => {
    const play = () => {
      const state = create(text, { bonusesEnabled: true }, 13);
      typeUntil(state, "human", 10_000);
      return state;
    };
    const first = play();
    expect(first.racers[1].bonuses).toHaveLength(3);
    expect(first.usedCheckpoints).toEqual([0.25, 0.5, 0.75]);
    expect(play()).toEqual(first);
  });
  it("ne distribue rien si les bonus sont désactivés", () => {
    const state = create(text);
    typeUntil(state, "human", text.length);
    expect(state.racers.every((r) => r.bonuses.length === 0 && r.text === text)).toBe(true);
  });
});
