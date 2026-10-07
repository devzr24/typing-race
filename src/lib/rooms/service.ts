import type { ErrorCode } from "@/i18n/messages";
import { normalizeRoomCode, validateRoomCode } from "./code";
import { generateUniqueRoomCode } from "./code-generator";
import { CodeTakenError, type RoomStore } from "./store";
import type { Identity, Participant, PublicRoom, Room } from "./types";

/** Participants dans l'ordre d'arrivée (le plus ancien en premier). */
export function byArrival(participants: Participant[]): Participant[] {
  return [...participants].sort(
    (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime() || a.id.localeCompare(b.id),
  );
}

/**
 * Hôte après le départ de `leavingKey` (ADR 0006) : inchangé si ce n'était pas l'hôte,
 * sinon le participant restant arrivé le plus tôt ; null si la salle est vide.
 */
export function hostAfterLeave(room: Room, leavingKey: string): string | null {
  const remaining = byArrival(room.participants.filter((p) => p.key !== leavingKey));
  if (remaining.length === 0) return null;
  if (room.hostKey !== leavingKey) return room.hostKey;
  return remaining[0].key;
}

export function toPublicRoom(room: Room): PublicRoom {
  return {
    code: room.code,
    status: room.status,
    participants: byArrival(room.participants).map((p) => ({
      id: p.id,
      displayName: p.displayName,
      image: p.image,
      isGuest: p.isGuest,
      isHost: p.key === room.hostKey,
    })),
  };
}

/** LOBBY-01 : crée une salle dont `host` devient l'hôte. Retourne son code. */
export async function createRoom(store: RoomStore, host: Identity): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await generateUniqueRoomCode((c) => store.isCodeTaken(c));
    try {
      await store.createRoom(code, host);
      return code;
    } catch (error) {
      // Code pris entre la vérification et la création : on en tire un autre.
      if (!(error instanceof CodeTakenError)) throw error;
    }
  }
  throw new Error("Impossible de créer la salle.");
}

export type JoinResult = { ok: true; code: string } | { ok: false; error: ErrorCode };

/** LOBBY-02 : rejoint une salle par son code. Rejoindre une salle où l'on est déjà ne change rien. */
export async function joinRoom(
  store: RoomStore,
  rawCode: string,
  identity: Identity,
): Promise<JoinResult> {
  const code = normalizeRoomCode(rawCode);
  const codeError = validateRoomCode(code);
  if (codeError) return { ok: false, error: codeError };

  return store.withRoom(code, async (room, locked) => {
    if (!room) return { ok: false, error: "roomNotFound" };
    const alreadyIn = room.participants.some((p) => p.key === identity.key);
    if (alreadyIn) return { ok: true, code };
    if (room.status !== "EN_ATTENTE") {
      return { ok: false, error: "roomNotWaiting" };
    }
    await locked.addParticipant(identity);
    return { ok: true, code };
  });
}

export type LeaveResult = "left" | "room-closed" | "not-in-room";

/** Retire un participant, transfère l'hôte si besoin et supprime la salle si elle est vide. */
export async function leaveRoom(store: RoomStore, code: string, key: string): Promise<LeaveResult> {
  return store.withRoom(code, async (room, locked) => {
    if (!room || !room.participants.some((p) => p.key === key)) return "not-in-room";
    const nextHost = hostAfterLeave(room, key);
    if (nextHost === null) {
      await locked.deleteRoom();
      return "room-closed";
    }
    await locked.removeParticipant(key);
    if (nextHost !== room.hostKey) await locked.setHost(nextHost);
    return "left";
  });
}
