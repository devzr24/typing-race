import { describe, expect, it } from "vitest";
import { addWords, allocateBonuses, chooseBonusType, crossedCheckpoints, isLaggingPlayer, removeWords, type BonusParticipant } from "./bonus";
import { progress } from "./metrics";

const players: BonusParticipant[] = [
  { id: "leader", status: "racing", progress: 0.8, joinedAt: 1, bonusesReceived: 0 },
  { id: "near", status: "racing", progress: 0.55, joinedAt: 2, bonusesReceived: 0 },
  { id: "far", status: "racing", progress: 0.54, joinedAt: 3, bonusesReceived: 0 },
  { id: "last", status: "racing", progress: 0.5, joinedAt: 4, bonusesReceived: 0 },
];

describe("checkpoints et retard", () => {
  it("exige un dépassement strict et accepte plusieurs franchissements", () => {
    expect(crossedCheckpoints(0, 0.25)).toEqual([]);
    expect(crossedCheckpoints(0.25, 0.8)).toEqual([0.25, 0.5, 0.75]);
    expect(crossedCheckpoints(0.8, 0.9)).toEqual([]);
    expect(crossedCheckpoints(0.1, 0.8, [0.25, 0.5, 0.75])).toEqual([]);
    expect(crossedCheckpoints(0.8, 0.2)).toEqual([]);
  });
  it("distingue dernier et écart strict de plus de 25 points", () => {
    expect(players.map((player) => isLaggingPlayer(player, players))).toEqual([false, false, true, true]);
    const close = players.map((player, index) => ({ ...player, progress: 0.8 - index * 0.01 }));
    expect(isLaggingPlayer(close[3], close)).toBe(true);
    expect(isLaggingPlayer(close[2], close)).toBe(false);
  });
  it("exclut finis, abandonnés et meneur, même seul ou à égalité", () => {
    for (const status of ["finished", "abandoned"] as const) {
      const player = { ...players[3], status };
      expect(isLaggingPlayer(player, [...players.slice(0, 3), player])).toBe(false);
    }
    expect(isLaggingPlayer(players[0], [players[0]])).toBe(false);
    const tied = players.map((player) => ({ ...player, progress: 0.5 }));
    expect(isLaggingPlayer(tied[0], tied)).toBe(false);
    expect(isLaggingPlayer(tied[3], tied)).toBe(true);
  });
  it("tolère les arrondis à 25 points et détecte un écart juste supérieur", () => {
    const participants = [
      { ...players[0], progress: 0.55 },
      { ...players[1], progress: 0.3 },
      { ...players[3], progress: 0.2 },
    ];
    expect(isLaggingPlayer(participants[1], participants)).toBe(false);
    const above = participants.map((player) => player.id === "near" ? { ...player, progress: 0.3 - 1e-8 } : player);
    expect(isLaggingPlayer(above[1], above)).toBe(true);
  });
});

describe("attribution", () => {
  it("consomme un checkpoint sans retardataire puis attribue au suivant", () => {
    const first = allocateBonuses({ participants: [players[0]], previous: 0, current: 0.3, seed: 42 });
    expect(first.grants).toEqual([]);
    expect(first.used).toEqual([0.25]);
    const next = allocateBonuses({ participants: [players[0], players[3]], previous: 0.3, current: 0.6, used: first.used, seed: 42 });
    expect(next.used).toEqual([0.25, 0.5]);
    expect(next.grants).toEqual([
      expect.objectContaining({ playerId: "last", checkpoint: 0.5 }),
    ]);
  });
  it("attribue par checkpoint et respecte le plafond sur toute la course", () => {
    const participants = players.map((player) => ({ ...player, bonusesReceived: player.id === "last" ? 2 : 0 }));
    const snapshot = structuredClone(participants);
    const result = allocateBonuses({ participants, previous: 0, current: 0.8, seed: 42 });
    expect(result.grants.filter((grant) => grant.playerId === "far")).toHaveLength(3);
    expect(result.grants.filter((grant) => grant.playerId === "last")).toHaveLength(1);
    expect(result.grants).toHaveLength(4);
    expect(allocateBonuses({ participants, previous: 0, current: 0.8, used: result.used, seed: 42 }).grants).toEqual([]);
    expect(allocateBonuses({ participants: players.map((p) => ({ ...p, bonusesReceived: 3 })), previous: 0, current: 1, seed: 1 }).grants).toEqual([]);
    expect(participants).toEqual(snapshot);
  });
  it("choisit trois types déterministes et cible le bon joueur", () => {
    expect([0, 1, 2, 3, 4, 5].map(chooseBonusType)).toEqual([0, 1, 2, 3, 4, 5].map(chooseBonusType));
    expect(new Set(Array.from({ length: 100 }, (_, seed) => chooseBonusType(seed))).size).toBe(3);
    const input = { participants: players, previous: 0, current: 1, seed: 123 };
    expect(allocateBonuses(input)).toEqual(allocateBonuses(input));
    for (const grant of allocateBonuses(input).grants) {
      expect(grant.targetId).toBe(grant.type === "minus3" ? grant.playerId : "leader");
    }
  });
});

describe("modifications du texte", () => {
  const text = "un deux trois quatre cinq six";
  it("normalise les mots reçus et ignore les éléments vides", () => {
    expect(addWords(text, 0, ["  sept huit ", "", "\tneuf\ndix", "  "])).toBe(text + " sept huit neuf dix");
    expect(addWords(text, 0, ["", " \t\n "])).toBe(text);
  });
  it("préserve le préfixe à toutes les positions et garde un mot restant", () => {
    for (let position = 0; position <= text.length; position++) {
      for (const changed of [addWords(text, position, ["sept", "huit", "neuf"]), removeWords(text, position, 3)]) {
        expect(changed.slice(0, position)).toBe(text.slice(0, position));
        if (position < text.length) expect(changed.slice(position)).toMatch(/\S/);
      }
    }
  });
  it("conserve le mot en cours et au moins un mot, y compris aux frontières", () => {
    expect(removeWords(text, 5, 100)).toBe("un deux");
    expect(removeWords(text, 3, 100)).toBe("un deux");
    expect(removeWords(text, 2, 100)).toBe("un deux");
    expect(removeWords(text, 0, 100)).toBe("un");
    expect(removeWords("un  deux\ttrois quatre  ", 4, 2)).toBe("un  deux");
    expect(removeWords(text, 5, 0)).toBe(text);
  });
  it("recalcule la progression sur la longueur modifiée", () => {
    const short = removeWords(text, 5, 3);
    const long = addWords(text, 5, ["sept", "huit", "neuf"]);
    expect(short).toBe("un deux trois");
    expect(long).toBe(text + " sept huit neuf");
    expect(progress(5, short.length)).toBe(5 / 13);
    expect(progress(5, long.length)).toBeLessThan(progress(5, text.length));
  });
  it("gère texte terminé, vide, espaces et positions invalides", () => {
    expect(addWords(text, text.length, ["sept"])).toBe(text);
    expect(removeWords(text, text.length, 3)).toBe(text);
    expect(addWords("", 0, ["un"])).toBe("");
    expect(removeWords("", 0, 3)).toBe("");
    expect(addWords("un  ", 0, ["deux"])).toBe("un  deux");
    expect(addWords(text, 0, [])).toBe(text);
    expect(() => addWords(text, -1, ["un"])).toThrow("INVALID_POSITION");
    expect(() => removeWords(text, text.length + 1, 3)).toThrow("INVALID_POSITION");
    expect(() => removeWords(text, 0, -1)).toThrow("INVALID_COUNT");
  });
});
