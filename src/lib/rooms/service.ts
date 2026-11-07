import type { ErrorCode } from "@/i18n/messages";
import { createHash, randomBytes, randomInt } from "node:crypto";
import type { TextConfig } from "@/lib/text/types";
import { normalizeRoomCode, validateRoomCode } from "./code";
import { generateUniqueRoomCode } from "./code-generator";
import { CodeTakenError, MembershipConflictError, type RoomStore } from "./store";
import type { CreatedInvite, Identity, LobbyRoom, Participant, PublicInvite, PublicRoom, Room, RoomInvite } from "./types";
import { activeRaces, clearRace } from "./race-memory";
import { hostCommandSchema, inviteTokenSchema } from "./schemas";
import { isJoinable, transitionRoom } from "./state-machine";

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
export function hostAfterLeave(room: Room, leavingKey: string, connectedKeys?: ReadonlySet<string>): string | null {
  if (room.hostKey !== leavingKey) return room.hostKey;
  const remaining = byArrival(room.participants.filter((p) => p.key !== leavingKey && (!connectedKeys || connectedKeys.has(p.key))));
  return remaining[0]?.key ?? null;
}

export function toPublicRoom(room: Room): PublicRoom {
  const race = activeRaces.get(room.code);
  return {
    code: room.code,
    status: room.status,
    capacity: room.capacity,
    visibility: room.visibility,
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

export type JoinResult = { ok: true; code: string } | { ok: false; error: ErrorCode; currentCode?: string };
export type JoinOptions = {
  isSpectator?: boolean;
  leaveCurrent?: boolean;
  connectedKeys?: (code: string) => Promise<ReadonlySet<string>>;
  onLeave?: (code: string, key: string) => Promise<void>;
};

export function participantCount(room: Pick<Room, "participants" | "bots">): number {
  return room.participants.filter((p) => !p.isSpectator).length + room.bots.length;
}

export async function leaveCurrentRoom(store: RoomStore, identity: Identity, options: JoinOptions, target?: string): Promise<JoinResult | null> {
  const currentCode = await store.findMembership(identity.key);
  if (!currentCode || currentCode === target) return null;
  if (!options.leaveCurrent) return { ok: false, error: "alreadyInRoom", currentCode };
  await leaveRoom(store, currentCode, identity.key, await options.connectedKeys?.(currentCode));
  await options.onLeave?.(currentCode, identity.key);
  return null;
}

function inviteHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
function publicInvite(invite: RoomInvite): PublicInvite {
  return { id: invite.id, usedByName: invite.usedByName, used: invite.usedAt !== null, revoked: invite.revokedAt !== null };
}

async function enterRoom(store: RoomStore, code: string, identity: Identity, options: JoinOptions, invitation?: { hash: string; ip: string }, publicOnly = false, checkOnly = false): Promise<JoinResult> {
  if (options.leaveCurrent && !checkOnly) {
    const target = await enterRoom(store, code, identity, options, invitation, publicOnly, true);
    if (!target.ok) return target;
  }
  // Le départ est une opération séparée : ne jamais imbriquer les verrous de deux salles.
  const conflict = checkOnly ? null : await leaveCurrentRoom(store, identity, options, code);
  if (conflict) return conflict;
  try {
    return await store.withRoom<JoinResult>(code, async (room, locked) => {
      if (!room || room.status === "FERMEE") return { ok: false, error: "roomNotFound" };
      if (publicOnly && room.visibility !== "PUBLIQUE") return { ok: false, error: "roomNotFound" };
      if (room.bannedKeys.includes(identity.key)) return { ok: false, error: "roomBanned" };
      const invite = invitation && room.invites.find((i) => i.tokenHash === invitation.hash);
      if (invitation && (!invite || invite.revokedAt || (invite.usedAt && (invite.usedIp !== invitation.ip || invite.usedByKey !== identity.key)))) {
        return { ok: false, error: "inviteInvalid" };
      }
      const alreadyIn = room.participants.some((p) => p.key === identity.key);
      if (alreadyIn) {
        if (!checkOnly && invite && !invite.usedAt) await locked.useInvite(invite.id, identity, invitation!.ip);
        return { ok: true, code };
      }
      if (room.visibility === "PRIVEE" && !invite) return { ok: false, error: "roomInviteRequired" };
      if (!isJoinable(room)) return { ok: false, error: "roomNotWaiting" };
      if (!options.isSpectator && participantCount(room) >= room.capacity) return { ok: false, error: "roomFull" };
      if (checkOnly) return { ok: true, code };
      await locked.addParticipant(identity, options.isSpectator);
      if (invite && !invite.usedAt) await locked.useInvite(invite.id, identity, invitation!.ip);
      return { ok: true, code };
    });
  } catch (error) {
    if (!(error instanceof MembershipConflictError)) throw error;
    const currentCode = await store.findMembership(identity.key);
    if (currentCode === code) return { ok: true, code };
    return { ok: false, error: "alreadyInRoom", ...(currentCode ? { currentCode } : {}) };
  }
}

/** LOBBY-02 : rejoint une salle par son code. Rejoindre une salle où l'on est déjà ne change rien. */
export async function joinRoom(
  store: RoomStore,
  rawCode: string,
  identity: Identity,
  options: JoinOptions = {},
): Promise<JoinResult> {
  const code = normalizeRoomCode(rawCode);
  const codeError = validateRoomCode(code);
  if (codeError) return { ok: false, error: codeError };

  return enterRoom(store, code, identity, options);
}

export async function joinInvite(store: RoomStore, token: string, identity: Identity, ip: string, options: JoinOptions = {}): Promise<JoinResult> {
  if (!inviteTokenSchema.safeParse(token).success) return { ok: false, error: "inviteInvalid" };
  const hash = inviteHash(token);
  const code = await store.findInviteRoom(hash);
  if (!code) return { ok: false, error: "inviteInvalid" };
  return enterRoom(store, code, identity, options, { hash, ip });
}

export async function listLobbyRooms(store: RoomStore): Promise<LobbyRoom[]> {
  return (await store.listRooms()).filter((r) => r.visibility === "PUBLIQUE" && r.status !== "FERMEE").map((r) => ({
    code: r.code, status: r.status, capacity: r.capacity, count: participantCount(r),
    textLanguage: r.config.textLanguage, complexity: r.config.complexity,
    hostName: r.participants.find((p) => p.key === r.hostKey)?.displayName ?? "",
  }));
}

export async function quickJoin(store: RoomStore, identity: Identity, options: JoinOptions = {}): Promise<JoinResult> {
  const rooms = (await store.listRooms()).filter((r) => r.visibility === "PUBLIQUE" && isJoinable(r)
    && participantCount(r) < r.capacity && !r.bannedKeys.includes(identity.key));
  rooms.sort((a, b) => (a.capacity - participantCount(a)) - (b.capacity - participantCount(b))
    || a.createdAt.getTime() - b.createdAt.getTime() || a.code.localeCompare(b.code));
  for (const room of rooms) {
    const result = await enterRoom(store, room.code, identity, options, undefined, true);
    if (result.ok || result.error === "alreadyInRoom") return result;
  }
  return { ok: false, error: "noPublicRoom" };
}

export type LeaveResult = "left" | "room-closed" | "not-in-room";

/** Retire un participant, transfère l'hôte si besoin et supprime la salle si elle est vide. */
export async function leaveRoom(store: RoomStore, code: string, key: string, connectedKeys?: ReadonlySet<string>): Promise<LeaveResult> {
  return store.withRoom(code, async (room, locked) => {
    if (!room || !room.participants.some((p) => p.key === key)) return "not-in-room";
    const nextHost = hostAfterLeave(room, key, connectedKeys);
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

export type CommandResult = { ok: true; invites?: PublicInvite[]; createdInvites?: CreatedInvite[]; kickedKey?: string } | { ok: false; error: ErrorCode };
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
    if (command.type === "listInvites") return { ok: true, invites: room.invites.map(publicInvite) };
    if (command.type === "createInvites") {
      if (room.status === "FERMEE") return { ok: false, error: "roomClosed" };
      const createdInvites: CreatedInvite[] = [];
      for (let i = 0; i < command.count; i++) {
        const token = randomBytes(32).toString("base64url");
        createdInvites.push({ ...publicInvite(await locked.addInvite(inviteHash(token))), token });
      }
      return { ok: true, createdInvites };
    }
    if (command.type === "kick") {
      const target = room.participants.find((p) => p.id === command.id && p.key !== identity.key);
      if (!target) return { ok: false, error: "roomKickInvalid" };
      await locked.ban(target.key);
      await locked.removeParticipant(target.key);
      return { ok: true, kickedKey: target.key };
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
    if (command.type === "configureAccess") {
      if (command.access.capacity < participantCount(room)) return { ok: false, error: "roomCapacityTooSmall" };
      await locked.setAccess(command.access.visibility, command.access.capacity);
    }
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
  if (command.type !== "listInvites") await publish(code);
  return result;
}
