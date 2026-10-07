import { CodeTakenError, type LockedRoom, type RoomStore } from "./store";
import type { Identity, Participant, Room } from "./types";

/** Stockage en mémoire pour les tests : même comportement que la version Prisma. */
export class MemoryRoomStore implements RoomStore {
  rooms = new Map<string, Room>();
  private nextId = 1;
  /** Horloge remplaçable pour contrôler l'ordre d'arrivée dans les tests. */
  now: () => Date = () => new Date();

  private participant(identity: Identity): Participant {
    return { ...identity, id: `p${this.nextId++}`, joinedAt: this.now() };
  }

  async findRoom(code: string) {
    const room = this.rooms.get(code);
    return room ? structuredClone(room) : null;
  }

  async isCodeTaken(code: string) {
    return this.rooms.has(code);
  }

  async createRoom(code: string, host: Identity) {
    if (this.rooms.has(code)) throw new CodeTakenError(code);
    const room: Room = {
      code,
      status: "EN_ATTENTE",
      hostKey: host.key,
      createdAt: this.now(),
      participants: [this.participant(host)],
    };
    this.rooms.set(code, room);
    return structuredClone(room);
  }

  async withRoom<T>(code: string, fn: (room: Room | null, locked: LockedRoom) => Promise<T>) {
    const room = this.rooms.get(code);
    const locked: LockedRoom = {
      addParticipant: async (identity) => {
        const p = this.participant(identity);
        room!.participants.push(p);
        return p;
      },
      removeParticipant: async (key) => {
        room!.participants = room!.participants.filter((p) => p.key !== key);
      },
      setHost: async (key) => {
        room!.hostKey = key;
      },
      deleteRoom: async () => {
        this.rooms.delete(code);
      },
    };
    return fn(room ? structuredClone(room) : null, locked);
  }
}
