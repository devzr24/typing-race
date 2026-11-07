import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRoomStore } from "./memory-store";
import { roomAccessSchema } from "./schemas";
import { createRoom, executeHostCommand, joinInvite, joinRoom, leaveRoom, listLobbyRooms, quickJoin, toPublicRoom } from "./service";
import { MembershipConflictError } from "./store";
import type { CreatedInvite, Identity, RoomStatus } from "./types";

const host: Identity = { key: "host", displayName: "Host", image: null, isGuest: false };
const player: Identity = { key: "player", displayName: "Player", image: null, isGuest: true };
const other: Identity = { key: "other", displayName: "Other", image: null, isGuest: false };
const code = "ABCDEF";
let store: MemoryRoomStore;
const command = (input: unknown, identity: Identity | null = host) => executeHostCommand(store, code, identity, input);

beforeEach(async () => {
  store = new MemoryRoomStore();
  await store.createRoom(code, host);
});

async function invitation(): Promise<CreatedInvite> {
  const result = await command({ type: "createInvites", count: 1 });
  if (!result.ok) throw new Error(result.error);
  return result.createdInvites![0];
}

describe("accès et capacité", () => {
  it.each(["PUBLIQUE", "SUR_CODE", "PRIVEE"] as const)("applique la visibilité %s au code et à l’explorateur", async (visibility) => {
    await command({ type: "configureAccess", access: { visibility, capacity: 8 } });
    expect((await listLobbyRooms(store)).map((r) => r.code)).toEqual(visibility === "PUBLIQUE" ? [code] : []);
    expect(await joinRoom(store, code, player)).toEqual(visibility === "PRIVEE"
      ? { ok: false, error: "roomInviteRequired" } : { ok: true, code });
  });

  it.each(["EN_ATTENTE", "RESULTATS", "DECOMPTE", "EN_COURSE", "FERMEE"] as RoomStatus[])("applique l’état %s à une nouvelle entrée", async (status) => {
    store.rooms.get(code)!.status = status;
    const result = await joinRoom(store, code, player);
    expect(result.ok).toBe(status === "EN_ATTENTE" || status === "RESULTATS");
    expect((await joinRoom(store, code, other, { isSpectator: true })).ok).toBe(result.ok);
  });

  it("accepte la reconnexion d’un membre dans une salle privée, pleine et en course", async () => {
    await joinRoom(store, code, player);
    await command({ type: "configureAccess", access: { visibility: "PRIVEE", capacity: 2 } });
    store.rooms.get(code)!.status = "EN_COURSE";
    expect(await joinRoom(store, code, player)).toEqual({ ok: true, code });
    expect((await store.findRoom(code))!.participants).toHaveLength(2);
  });

  it("compte les bots mais exclut les spectateurs, et refuse une capacité trop faible", async () => {
    await command({ type: "configureAccess", access: { visibility: "PUBLIQUE", capacity: 2 } });
    await command({ type: "addBot", level: "EXPERT" });
    expect(await joinRoom(store, code, player)).toEqual({ ok: false, error: "roomFull" });
    expect(await joinRoom(store, code, player, { isSpectator: true })).toEqual({ ok: true, code });
    expect(await command({ type: "addBot", level: "EXPERT" })).toEqual({ ok: false, error: "roomFull" });
    await command({ type: "configureAccess", access: { visibility: "PUBLIQUE", capacity: 3 } });
    await command({ type: "addBot", level: "NOOB" });
    expect(await command({ type: "configureAccess", access: { visibility: "PRIVEE", capacity: 2 } })).toEqual({ ok: false, error: "roomCapacityTooSmall" });
    expect((await listLobbyRooms(store))[0]).toMatchObject({ count: 3, capacity: 3 });
  });

  it("sérialise les entrées concurrentes à la dernière place", async () => {
    await command({ type: "configureAccess", access: { visibility: "PUBLIQUE", capacity: 2 } });
    const results = await Promise.all([joinRoom(store, code, player), joinRoom(store, code, other)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "roomFull" }]);
  });

  it.each([1, 31, 2.5, "8"])("refuse la capacité %s", (capacity) => {
    expect(roomAccessSchema.safeParse({ visibility: "PUBLIQUE", capacity }).success).toBe(false);
  });

  it.each([2, 30])("accepte la capacité %s aux résultats et verrouille en course", async (capacity) => {
    store.rooms.get(code)!.status = "RESULTATS";
    const input = { type: "configureAccess", access: { visibility: "SUR_CODE", capacity } };
    expect(await command(input)).toEqual({ ok: true });
    store.rooms.get(code)!.status = "EN_COURSE";
    expect(await command(input)).toEqual({ ok: false, error: "roomConfigLocked" });
  });
});

describe("invitations et expulsion", () => {
  it("crée des jetons distincts de 256 bits et ne stocke que SHA-256", async () => {
    const result = await command({ type: "createInvites", count: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tokens = result.createdInvites!.map((i) => i.token);
    expect(new Set(tokens).size).toBe(3);
    const room = (await store.findRoom(code))!;
    tokens.forEach((token, index) => {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, "base64url")).toHaveLength(32);
      expect(room.invites[index].tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
      expect(JSON.stringify(room)).not.toContain(token);
      expect(JSON.stringify(toPublicRoom(room))).not.toContain(room.invites[index].tokenHash);
    });
    const list = await command({ type: "listInvites" });
    expect(JSON.stringify(list)).not.toContain("token");
  });

  it("lie la première utilisation à la clé ET l’IP et autorise le retour", async () => {
    await command({ type: "configureAccess", access: { visibility: "PRIVEE", capacity: 8 } });
    const { token } = await invitation();
    expect(await joinInvite(store, token, player, "ip-1")).toEqual({ ok: true, code });
    expect(await joinInvite(store, token, player, "ip-2")).toEqual({ ok: false, error: "inviteInvalid" });
    expect(await joinInvite(store, token, other, "ip-1")).toEqual({ ok: false, error: "inviteInvalid" });
    await leaveRoom(store, code, player.key);
    expect(await joinInvite(store, token, player, "ip-1")).toEqual({ ok: true, code });
    expect(await command({ type: "listInvites" })).toMatchObject({ ok: true, invites: [{ used: true, usedByName: player.displayName }] });
  });

  it("une invitation concurrente n’est utilisée que par une personne", async () => {
    const { token } = await invitation();
    const results = await Promise.all([joinInvite(store, token, player, "ip-1"), joinInvite(store, token, other, "ip-1")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "inviteInvalid" }]);
  });

  it("ne consomme pas le lien lors d’un refus de capacité ou d’état", async () => {
    const { token } = await invitation();
    await command({ type: "configureAccess", access: { visibility: "PRIVEE", capacity: 2 } });
    await command({ type: "addBot", level: "NOOB" });
    expect(await joinInvite(store, token, player, "ip-1")).toEqual({ ok: false, error: "roomFull" });
    store.rooms.get(code)!.status = "EN_COURSE";
    expect(await joinInvite(store, token, player, "ip-1", { isSpectator: true })).toEqual({ ok: false, error: "roomNotWaiting" });
    expect((await store.findRoom(code))!.invites[0].usedAt).toBeNull();
    store.rooms.get(code)!.status = "RESULTATS";
    expect(await joinInvite(store, token, player, "ip-1", { isSpectator: true })).toEqual({ ok: true, code });
  });

  it.each([false, true])("expulse et bannit une personne (spectateur : %s), révoque ses liens", async (isSpectator) => {
    const { token } = await invitation();
    await joinInvite(store, token, player, "ip-1", { isSpectator });
    const id = (await store.findRoom(code))!.participants.find((p) => p.key === player.key)!.id;
    expect(await command({ type: "kick", id })).toEqual({ ok: true, kickedKey: player.key });
    expect((await store.findRoom(code))!.participants).toHaveLength(1);
    expect((await store.findRoom(code))!.invites[0].revokedAt).not.toBeNull();
    expect(await joinRoom(store, code, player)).toEqual({ ok: false, error: "roomBanned" });
    expect(await joinInvite(store, token, player, "ip-1")).toEqual({ ok: false, error: "roomBanned" });
    expect(await quickJoin(store, player)).toEqual({ ok: false, error: "noPublicRoom" });
  });

  it.each(["close", "leave"])("invalide tous les liens à la fermeture : %s", async (method) => {
    const { token } = await invitation();
    if (method === "close") await command({ type: "close" });
    else await leaveRoom(store, code, host.key);
    expect(await joinInvite(store, token, player, "ip-1")).toEqual({ ok: false, error: "inviteInvalid" });
  });

  it("refuse de s’expulser soi-même", async () => {
    const id = (await store.findRoom(code))!.participants[0].id;
    expect(await command({ type: "kick", id })).toEqual({ ok: false, error: "roomKickInvalid" });
  });

  it.each([
    { type: "createInvites", count: 1 }, { type: "listInvites" }, { type: "kick", id: "p1" },
    { type: "configureAccess", access: { visibility: "PRIVEE", capacity: 2 } },
  ])("vérifie la session et l’hôte sous verrou : $type", async (input) => {
    expect(await command(input, null)).toEqual({ ok: false, error: "loginRequired" });
    expect(await command(input, player)).toEqual({ ok: false, error: "roomHostOnly" });
    await joinRoom(store, code, player);
    await store.withRoom(code, async (_, locked) => locked.setHost(player.key));
    expect(await command(input, host)).toEqual({ ok: false, error: "roomHostOnly" });
  });

  it.each([{ type: "createInvites", count: 31 }, { type: "createInvites", count: 0 }, { type: "kick", id: "" },
    { type: "configureAccess", access: { visibility: "INVISIBLE", capacity: 2 } }])("valide les commandes avec Zod : %j", async (input) => {
    expect(await command(input)).toEqual({ ok: false, error: "roomConfigInvalid" });
  });
});

describe("présence unique et transfert", () => {
  it.each(["missing", "private", "banned", "closed", "full", "racing", "invite"])("conserve la salle actuelle si la cible est refusée : %s", async (reason) => {
    await joinRoom(store, code, player);
    const target = await createRoom(store, other);
    const room = store.rooms.get(target)!;
    const onLeave = vi.fn(async () => {});
    let error = "roomNotFound";
    if (reason === "missing") store.rooms.delete(target);
    if (reason === "private") { room.visibility = "PRIVEE"; error = "roomInviteRequired"; }
    if (reason === "banned") { room.bannedKeys.push(host.key); error = "roomBanned"; }
    if (reason === "closed") room.status = "FERMEE";
    if (reason === "full") { room.capacity = 1; error = "roomFull"; }
    if (reason === "racing") { room.status = "EN_COURSE"; error = "roomNotWaiting"; }
    let result;
    if (reason === "invite") {
      const created = await executeHostCommand(store, target, other, { type: "createInvites", count: 1 });
      if (!created.ok) throw new Error(created.error);
      room.invites[0].revokedAt = new Date();
      error = "inviteInvalid";
      result = await joinInvite(store, created.createdInvites![0].token, host, "ip-1", { leaveCurrent: true, onLeave });
    } else {
      result = await joinRoom(store, target, host, { leaveCurrent: true, onLeave });
    }
    expect(result).toEqual({ ok: false, error });
    expect(await store.findMembership(host.key)).toBe(code);
    expect((await store.findRoom(code))!.hostKey).toBe(host.key);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("propose de quitter l’ancienne salle puis transfère son hôte immédiatement", async () => {
    await joinRoom(store, code, player);
    const target = await createRoom(store, other);
    expect(await joinRoom(store, target, host)).toEqual({ ok: false, error: "alreadyInRoom", currentCode: code });
    const onLeave = vi.fn(async () => {});
    expect(await joinRoom(store, target, host, { leaveCurrent: true, connectedKeys: async () => new Set([player.key]), onLeave })).toEqual({ ok: true, code: target });
    expect((await store.findRoom(code))!.hostKey).toBe(player.key);
    expect(onLeave).toHaveBeenCalledWith(code, host.key);
    expect(await store.findMembership(host.key)).toBe(target);
  });

  it("traite une violation d’unicité concurrente avec le code de la salle actuelle", async () => {
    const target = await createRoom(store, other);
    const original = store.findMembership.bind(store);
    vi.spyOn(store, "findMembership").mockResolvedValueOnce(null).mockImplementation(original);
    expect(await joinRoom(store, target, host)).toEqual({ ok: false, error: "alreadyInRoom", currentCode: code });
    await expect(createRoom(store, host)).rejects.toBeInstanceOf(MembershipConflictError);
  });

  it("une personne ne rejoint pas deux salles simultanément", async () => {
    const target = await createRoom(store, other);
    const results = await Promise.all([joinRoom(store, code, player), joinRoom(store, target, player)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ error: "alreadyInRoom", currentCode: expect.any(String) });
  });

  it("transfère à l’humain connecté le plus ancien, y compris spectateur, sans choisir les bots", async () => {
    await joinRoom(store, code, player);
    await joinRoom(store, code, other, { isSpectator: true });
    await command({ type: "addBot", level: "NOOB" });
    expect(await leaveRoom(store, code, host.key, new Set([other.key]))).toBe("left");
    expect((await store.findRoom(code))!.hostKey).toBe(other.key);
  });

  it("ferme sans humain connecté même s’il reste des présences déconnectées et des bots", async () => {
    await joinRoom(store, code, player);
    await command({ type: "addBot", level: "NOOB" });
    expect(await leaveRoom(store, code, host.key, new Set())).toBe("room-closed");
    expect(await store.findRoom(code)).toBeNull();
  });
});

describe("partie rapide", () => {
  it("conserve la salle actuelle si la cible devient indisponible après la liste", async () => {
    store.rooms.get(code)!.visibility = "SUR_CODE";
    const target = await createRoom(store, other);
    const rooms = await store.listRooms();
    vi.spyOn(store, "listRooms").mockResolvedValueOnce(rooms);
    store.rooms.get(target)!.status = "EN_COURSE";
    const onLeave = vi.fn(async () => {});
    expect(await quickJoin(store, host, { leaveCurrent: true, onLeave })).toEqual({ ok: false, error: "noPublicRoom" });
    expect(await store.findMembership(host.key)).toBe(code);
    expect((await store.findRoom(code))!.hostKey).toBe(host.key);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("choisit le moins de places libres, puis la plus ancienne", async () => {
    store.now = () => new Date(Date.now() + 10_000);
    const target = await createRoom(store, other);
    store.rooms.get(target)!.capacity = 3;
    expect(await quickJoin(store, player)).toEqual({ ok: true, code: target });
    await leaveRoom(store, target, player.key);
    store.rooms.get(code)!.capacity = 3;
    expect(await quickJoin(store, player)).toEqual({ ok: true, code });
  });

  it("écarte les salles cachées, pleines, bannies et non joignables", async () => {
    for (const visibility of ["SUR_CODE", "PRIVEE"] as const) {
      store.rooms.get(code)!.visibility = visibility;
      expect(await quickJoin(store, player)).toEqual({ ok: false, error: "noPublicRoom" });
    }
    store.rooms.get(code)!.visibility = "PUBLIQUE";
    store.rooms.get(code)!.bannedKeys = [player.key];
    expect(await quickJoin(store, player)).toEqual({ ok: false, error: "noPublicRoom" });
    store.rooms.get(code)!.bannedKeys = [];
    for (const status of ["DECOMPTE", "EN_COURSE", "FERMEE"] as const) {
      store.rooms.get(code)!.status = status;
      expect(await quickJoin(store, player)).toEqual({ ok: false, error: "noPublicRoom" });
    }
    store.rooms.get(code)!.status = "RESULTATS";
    store.rooms.get(code)!.capacity = 2;
    await command({ type: "addBot", level: "NOOB" });
    expect(await quickJoin(store, player)).toEqual({ ok: false, error: "noPublicRoom" });
  });
});
