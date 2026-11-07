import type { ErrorCode } from "@/i18n/messages";
import { randomInt } from "node:crypto";
import type { TextConfig } from "@/lib/text/types";
import { normalizeRoomCode, validateRoomCode } from "./code";
import { generateUniqueRoomCode } from "./code-generator";
import { CodeTakenError, type RoomStore } from "./store";
import type { Identity, Participant, PublicRoom, Room } from "./types";
import { activeRaces, clearRace } from "./race-memory";
import { hostCommandSchema } from "./schemas";
import { transitionRoom } from "./state-machine";

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
  const race = activeRaces.get(room.code);
  return {
    code: room.code,
    status: room.status,
    config: room.config,
    bots: room.bots,
    race: race && room.status !== "EN_ATTENTE" && room.status !== "FERMEE" ? { text: race.text, startsAt: race.startsAt } : null,
    serverNow: Date.now(),
    participants: byArrival(room.participants).map((p) => ({
      id: p.id,
      displayName: p.displayName,
      image: p.image,
      isGuest: p.isGuest,
      isSpectator: p.isSpectator,
      isHost: p.key === room.hostKey,
    })),
  };
}

export function validateRoomCreator(host: Identity): ErrorCode | undefined {
  return host.isGuest ? "guestCannotCreateRoom" : undefined;
}

export function parseHostRole(value: FormDataEntryValue | null): "participant" | "spectator" | null {
  return value === "participant" || value === "spectator" ? value : null;
}

/** LOBBY-01 : crée une salle dont `host` devient l'hôte. Retourne son code. */
export async function createRoom(store: RoomStore, host: Identity, isSpectator = false): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await generateUniqueRoomCode((c) => store.isCodeTaken(c));
    try {
      await store.createRoom(code, host, isSpectator);
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
    if (room.participants.filter((p) => !p.isSpectator).length + room.bots.length >= room.capacity) {
      return { ok: false, error: "roomFull" };
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
      const result = transitionRoom({ ...room, participants: [] }, "NO_HUMANS");
      if (result.ok) await locked.setStatus(result.status);
      await locked.deleteRoom();
      clearRace(code);
      return "room-closed";
    }
    await locked.removeParticipant(key);
    if (nextHost !== room.hostKey) await locked.setHost(nextHost);
    return "left";
  });
}

export type CommandResult = { ok: true } | { ok: false; error: ErrorCode };
type TextLoader = (config: TextConfig, seed: number) => Promise<
  { ok: true; text: string } | { ok: false; reason: "NOT_ENOUGH_WORDS" | "NO_PASSAGE" }
>;
type Publish = (code: string) => Promise<void>;
const noPublish: Publish = async () => {};

export async function finishRace(store: RoomStore, code: string, publish: Publish = noPublish): Promise<CommandResult> {
  const result = await store.withRoom<CommandResult>(code, async (room, locked) => {
    if (!room) return { ok: false, error: "roomNotFound" };
    const next = transitionRoom(room, "FINISH");
    if (!next.ok) return next;
    await locked.setStatus(next.status);
    clearTimeout(activeRaces.get(code)?.timer);
    return { ok: true };
  });
  if (result.ok) await publish(code);
  return result;
}

/** Toutes les intentions de l'hôte passent sous le même verrou que les départs. */
export async function executeHostCommand(
  store: RoomStore,
  code: string,
  identity: Identity | null,
  input: unknown,
  publish: Publish = noPublish,
  loadText: TextLoader = async (config, seed) => (await import("@/lib/text/load")).loadRaceText(config, seed),
): Promise<CommandResult> {
  if (!identity) return { ok: false, error: "loginRequired" };
  const parsed = hostCommandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "roomConfigInvalid" };
  const command = parsed.data;
  let prepared: { text: string; startsAt: number; timeLimitSec: number | null } | undefined;
  const result = await store.withRoom<CommandResult>(code, async (room, locked) => {
    if (!room) return { ok: false, error: "roomNotFound" };
    if (room.hostKey !== identity.key || !room.participants.some((p) => p.key === identity.key)) {
      return { ok: false, error: "roomHostOnly" };
    }
    if (command.type === "start" || command.type === "reset" || command.type === "close") {
      const next = transitionRoom(room, command.type === "start" ? "START" : command.type === "reset" ? "RESET" : "CLOSE");
      if (!next.ok) return next;
      if (command.type === "start") {
        const generated = await loadText(room.config, randomInt(0, 2 ** 32));
        if (!generated.ok) {
          return { ok: false, error: generated.reason === "NOT_ENOUGH_WORDS" ? "raceNotEnoughWords" : "raceNoPassage" };
        }
        prepared = { text: generated.text, startsAt: Date.now() + 3000, timeLimitSec: room.config.timeLimitSec };
      }
      await locked.setStatus(next.status);
      if (command.type === "close") await locked.deleteRoom();
      if (command.type !== "start") clearRace(code);
      return { ok: true };
    }
    if (room.status !== "EN_ATTENTE" && room.status !== "RESULTATS") {
      return { ok: false, error: "roomConfigLocked" };
    }
    if (command.type === "configure") await locked.setConfig(command.config);
    if (command.type === "addBot") {
      if (room.participants.filter((p) => !p.isSpectator).length + room.bots.length >= room.capacity) {
        return { ok: false, error: "roomFull" };
      }
      await locked.addBot(command.level, `Bot-${randomInt(100000, 1000000)}`);
    }
    if (command.type === "removeBot") {
      if (!room.bots.some((bot) => bot.id === command.id)) return { ok: false, error: "roomBotNotFound" };
      await locked.removeBot(command.id);
    }
    return { ok: true };
  });
  if (!result.ok) return result;
  if (prepared) {
    const race = { text: prepared.text, startsAt: prepared.startsAt, timer: undefined as ReturnType<typeof setTimeout> | undefined };
    const limit = prepared.timeLimitSec;
    activeRaces.set(code, race);
    race.timer = setTimeout(async () => {
      try {
        const changed = await store.withRoom(code, async (room, locked) => {
          if (!room || activeRaces.get(code) !== race) return false;
          const next = transitionRoom(room, "COUNTDOWN_END");
          if (!next.ok) return false;
          await locked.setStatus(next.status);
          return true;
        });
        if (!changed) return;
        if (limit !== null) {
          race.timer = setTimeout(() => {
            if (activeRaces.get(code) !== race) return;
            void finishRace(store, code, publish).catch((error: unknown) => console.error("> finishRace", error));
          }, Math.max(0, race.startsAt + limit * 1000 - Date.now()));
        }
        await publish(code);
      } catch (error) {
        console.error("> countdown", error);
      }
    }, Math.max(0, race.startsAt - Date.now()));
  }
  await publish(code);
  return result;
}
