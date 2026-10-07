import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CodeTakenError, type LockedRoom, type RoomStore } from "./store";
import type { Identity, Room } from "./types";

const withParticipants = { participants: true } as const;
type RoomRow = Prisma.RoomGetPayload<{ include: typeof withParticipants }>;

function toRoom(row: RoomRow): Room {
  return {
    code: row.code,
    status: row.status,
    hostKey: row.hostKey,
    createdAt: row.createdAt,
    participants: row.participants.map((p) => ({
      id: p.id,
      key: p.key,
      displayName: p.displayName,
      image: p.image,
      isGuest: p.isGuest,
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

  async createRoom(code: string, host: Identity) {
    try {
      const row = await this.db.room.create({
        data: { code, hostKey: host.key, participants: { create: participantData(host) } },
        include: withParticipants,
      });
      return toRoom(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
        addParticipant: async (identity) => {
          const p = await tx.roomParticipant.create({ data: { roomId, ...participantData(identity) } });
          return { ...identity, id: p.id, joinedAt: p.joinedAt };
        },
        removeParticipant: async (key) => {
          await tx.roomParticipant.delete({ where: { roomId_key: { roomId, key } } });
        },
        setHost: async (key) => {
          await tx.room.update({ where: { id: roomId }, data: { hostKey: key } });
        },
        deleteRoom: async () => {
          await tx.room.delete({ where: { id: roomId } });
        },
      };
      return fn(row ? toRoom(row) : null, locked);
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
