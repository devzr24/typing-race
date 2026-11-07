import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRoomStore } from "./memory-store";
import { transitionRoom, type RoomTransition } from "./state-machine";
import type { Room, RoomStatus } from "./types";

let room: Room;
beforeEach(async () => {
  room = await new MemoryRoomStore().createRoom("ABCDEF", { key: "host", displayName: "Host", image: null, isGuest: false });
  room.bots.push({ id: "bot", name: "Bot", level: "BEGINNER" });
});

describe("machine à états de la salle", () => {
  it.each<[RoomStatus, RoomTransition, RoomStatus]>([
    ["EN_ATTENTE", "START", "DECOMPTE"], ["DECOMPTE", "COUNTDOWN_END", "EN_COURSE"],
    ["EN_COURSE", "FINISH", "RESULTATS"], ["RESULTATS", "RESET", "EN_ATTENTE"],
  ])("%s + %s → %s sans mutation", (status, event, next) => {
    room.status = status;
    const before = structuredClone(room);
    expect(transitionRoom(room, event)).toEqual({ ok: true, status: next });
    expect(room).toEqual(before);
  });

  it.each<RoomStatus>(["EN_ATTENTE", "DECOMPTE", "EN_COURSE", "RESULTATS", "FERMEE"])("ferme depuis %s", (status) => {
    room.status = status;
    expect(transitionRoom(room, "CLOSE")).toEqual({ ok: true, status: "FERMEE" });
    expect(transitionRoom({ ...room, participants: [] }, "NO_HUMANS")).toEqual({ ok: true, status: "FERMEE" });
    expect(transitionRoom(room, "NO_HUMANS")).toEqual({ ok: false, error: "roomInvalidTransition" });
  });

  it("refuse toutes les paires état/événement non prévues", () => {
    const expected = { START: "EN_ATTENTE", COUNTDOWN_END: "DECOMPTE", FINISH: "EN_COURSE", RESET: "RESULTATS" } as const;
    for (const status of ["EN_ATTENTE", "DECOMPTE", "EN_COURSE", "RESULTATS", "FERMEE"] as const) {
      for (const event of Object.keys(expected) as (keyof typeof expected)[]) {
        if (status === expected[event]) continue;
        expect(transitionRoom({ ...room, status }, event)).toEqual({ ok: false, error: "roomInvalidTransition" });
      }
    }
  });
});
