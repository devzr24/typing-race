import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CodeTakenError, MembershipConflictError, type LockedRoom, type RoomStore } from "./store";
import type { Identity, Room } from "./types";

const withParticipants = { participants: true, bots: { orderBy: { createdAt: "asc" } }, invites: true, bans: true } as const;
type RoomRow = Prisma.RoomGetPayload<{ include: typeof withParticipants }>;

function toRoom(row: RoomRow): Room {
  return {
    code: row.code,
    status: row.status,
    hostKey: row.hostKey,
    createdAt: row.createdAt,
    capacity: row.capacity,
    visibility: row.visibility,
    invites: row.invites,
    bannedKeys: row.bans.map((ban) => ban.key),
    config: {
      timeLimitSec: row.timeLimitSec, textLanguage: row.textLanguage, textType: row.textType,
      wordCount: row.wordCount, complexity: row.complexity, punctuation: row.punctuation,
      numbers: row.numbers, capitals: row.capitals, accents: row.accents,
      includeChars: row.includeChars, excludeChars: row.excludeChars,
      errorMode: row.errorMode, bonusesEnabled: row.bonusesEnabled,
    },
    bots: row.bots.map(({ id, name, level }) => ({ id, name, level })),
    participants: row.participants.map((p) => ({
      id: p.id,
      key: p.key,
      displayName: p.displayName,
      image: p.image,
      isGuest: p.isGuest,
      isSpectator: p.isSpectator,
      joinedAt: p.joinedAt,
    })),
  };
}

function participantData(identity: Identity) {
  return {
    key: identity.key,
    userId: identity.isGuest ? null : identity.key,
    displayName: identity.displayName,
    image: identity.image,
    isGuest: identity.isGuest,
  };
}

export class PrismaRoomStore implements RoomStore {
  constructor(private readonly db: PrismaClient = prisma) {}

  async findRoom(code: string) {
    const row = await this.db.room.findUnique({ where: { code }, include: withParticipants });
    return row ? toRoom(row) : null;
  }

  async isCodeTaken(code: string) {
    return (await this.db.room.count({ where: { code } })) > 0;
  }

  async listRooms() {
    return (await this.db.room.findMany({ where: { visibility: "PUBLIQUE", status: { not: "FERMEE" } }, include: withParticipants })).map(toRoom);
  }

  async findMembership(key: string) {
    const row = await this.db.roomParticipant.findUnique({ where: { key }, select: { room: { select: { code: true } } } });
    return row?.room.code ?? null;
  }

  async findInviteRoom(tokenHash: string) {
    const row = await this.db.roomInvite.findUnique({ where: { tokenHash }, select: { room: { select: { code: true } } } });
    return row?.room.code ?? null;
  }

  async createRoom(code: string, host: Identity, isSpectator = false) {
    try {
      const row = await this.db.room.create({
        data: { code, hostKey: host.key, participants: { create: { ...participantData(host), isSpectator } } },
        include: withParticipants,
      });
      return toRoom(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const current = await this.findMembership(host.key);
        if (current) throw new MembershipConflictError(current);
        throw new CodeTakenError(code);
      }
      throw error;
    }
  }

  async withRoom<T>(code: string, fn: (room: Room | null, locked: LockedRoom) => Promise<T>) {
    return this.db.$transaction(async (tx) => {
      // Verrou sur la ligne de la salle jusqu'à la fin de la transaction.
      await tx.$queryRaw`SELECT id FROM "Room" WHERE code = ${code} FOR UPDATE`;
      const row = await tx.room.findUnique({ where: { code }, include: withParticipants });
      const roomId = row?.id ?? "";
      const locked: LockedRoom = {
        addParticipant: async (identity, isSpectator = false) => {
          const p = await tx.roomParticipant.create({ data: { roomId, ...participantData(identity), isSpectator } });
          return { ...identity, id: p.id, joinedAt: p.joinedAt, isSpectator: p.isSpectator };
        },
        removeParticipant: async (key) => {
          await tx.roomParticipant.deleteMany({ where: { roomId, key } });
        },
        setHost: async (key) => {
          await tx.room.update({ where: { id: roomId }, data: { hostKey: key } });
        },
        setStatus: async (status) => {
          await tx.room.update({ where: { id: roomId }, data: { status } });
        },
        setConfig: async (config) => {
          await tx.room.update({ where: { id: roomId }, data: config });
        },
        setAccess: async (visibility, capacity) => {
          await tx.room.update({ where: { id: roomId }, data: { visibility, capacity } });
        },
        addInvite: async (tokenHash) => tx.roomInvite.create({ data: { roomId, tokenHash } }),
        useInvite: async (id, identity, ip) => {
          await tx.roomInvite.update({ where: { id }, data: { usedByKey: identity.key, usedByName: identity.displayName, usedIp: ip, usedAt: new Date() } });
        },
        ban: async (key) => {
          await tx.roomBan.upsert({ where: { roomId_key: { roomId, key } }, create: { roomId, key }, update: {} });
          await tx.roomInvite.updateMany({ where: { roomId, usedByKey: key }, data: { revokedAt: new Date() } });
        },
        addBot: async (level, name) => {
          await tx.roomBot.create({ data: { roomId, level, name } });
        },
        removeBot: async (id) => {
          await tx.roomBot.deleteMany({ where: { roomId, id } });
        },
        deleteRoom: async () => {
          await tx.room.delete({ where: { id: roomId } });
        },
      };
      return fn(row ? toRoom(row) : null, locked);
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        && (error.meta?.modelName === "RoomParticipant" || String(error.meta?.target).includes("key"))) {
        throw new MembershipConflictError(null);
      }
      throw error;
    });
  }

  /**
   * Courses interrompues par un redémarrage : le texte et les minuteries vivaient en mémoire.
   * Les salles en décompte ou en course reviennent en attente.
   */
  async resetInterruptedRaces(): Promise<void> {
    await this.db.room.updateMany({
      where: { status: { in: ["DECOMPTE", "EN_COURSE"] } },
      data: { status: "EN_ATTENTE" },
    });
  }

  /** Toutes les présences enregistrées (utilisé au démarrage du serveur). */
  async listMemberships(): Promise<{ code: string; key: string }[]> {
    const rows = await this.db.roomParticipant.findMany({
      select: { key: true, room: { select: { code: true } } },
    });
    return rows.map((r) => ({ code: r.room.code, key: r.key }));
  }
}

export const roomStore = new PrismaRoomStore();
