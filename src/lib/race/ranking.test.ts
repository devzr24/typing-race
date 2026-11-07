import { expect, it } from "vitest";
import { rankParticipants, type RaceParticipant } from "./ranking";

it("classe les trois statuts, puis les égalités par arrivée dans la salle", () => {
  const participants: RaceParticipant[] = [
    { id: "a", status: "abandoned", progress: 1, joinedAt: 1 },
    { id: "t2", status: "timeout", progress: 0.8, joinedAt: 3 },
    { id: "f2", status: "finished", finishMs: 200, progress: 1, joinedAt: 1 },
    { id: "f1b", status: "finished", finishMs: 100, progress: 1, joinedAt: 2 },
    { id: "t1", status: "timeout", progress: 0.8, joinedAt: 2 },
    { id: "f1a", status: "finished", finishMs: 100, progress: 1, joinedAt: 1 },
    { id: "a2", status: "abandoned", progress: 0.5, joinedAt: 3 },
    { id: "a1", status: "abandoned", progress: 0.5, joinedAt: 2 },
    { id: "t3", status: "timeout", progress: 0.2, joinedAt: 1 },
  ];
  const original = structuredClone(participants);
  const ranked = rankParticipants(participants);
  expect(ranked.map((player) => player.id)).toEqual(["f1a", "f1b", "f2", "t1", "t2", "t3", "a", "a1", "a2"]);
  expect(ranked.map((player) => player.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(participants).toEqual(original);
  expect(rankParticipants([])).toEqual([]);
});

it("classe les finis sans temps après les temps connus", () => {
  expect(rankParticipants([
    { id: "b", status: "finished", progress: 1, joinedAt: 2 },
    { id: "a", status: "finished", progress: 1, joinedAt: 1 },
    { id: "c", status: "finished", finishMs: 100, progress: 1, joinedAt: 3 },
  ]).map((player) => player.id)).toEqual(["c", "a", "b"]);
});
