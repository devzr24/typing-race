import type { ErrorCode } from "@/i18n/messages";
import type { Room, RoomStatus } from "./types";

export type RoomTransition = "START" | "COUNTDOWN_END" | "FINISH" | "RESET" | "CLOSE" | "NO_HUMANS";
export type TransitionResult = { ok: true; status: RoomStatus } | { ok: false; error: ErrorCode };

export function launchError(room: { participants: readonly { isSpectator: boolean }[]; bots: readonly { id: string }[] }): ErrorCode | undefined {
  const humans = room.participants.filter((p) => !p.isSpectator).length;
  if (humans === 0) return "raceNeedsHuman";
  if (humans + room.bots.length < 2) return "raceNeedsParticipants";
}

export function transitionRoom(room: Room, event: RoomTransition): TransitionResult {
  if (event === "CLOSE" || (event === "NO_HUMANS" && room.participants.length === 0)) {
    return { ok: true, status: "FERMEE" };
  }
  if (room.status === "EN_ATTENTE" && event === "START") {
    const error = launchError(room);
    return error ? { ok: false, error } : { ok: true, status: "DECOMPTE" };
  }
  if (room.status === "DECOMPTE" && event === "COUNTDOWN_END") return { ok: true, status: "EN_COURSE" };
  if (room.status === "EN_COURSE" && event === "FINISH") return { ok: true, status: "RESULTATS" };
  if (room.status === "RESULTATS" && event === "RESET") return { ok: true, status: "EN_ATTENTE" };
  return { ok: false, error: "roomInvalidTransition" };
}
