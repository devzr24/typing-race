import { CodeTakenError, MembershipConflictError, type LockedRoom, type RoomStore } from "./store";
import type { Identity, Participant, Room } from "./types";
import { defaultRaceConfig } from "./types";

/** Stockage en mémoire pour les tests : même comportement que la version Prisma. */
export class MemoryRoomStore implements RoomStore {
  rooms = new Map<string, Room>();
  private nextId = 1;
  private locks = new Map<string, Promise<void>>();
  /** Horloge remplaçable pour contrôler l'ordre d'arrivée dans les tests. */
  now: () => Date = () => new Date();

  private participant(identity: Identity, isSpectator = false): Participant {
    return { ...identity, isSpectator, id: `p${this.nextId++}`, joinedAt: this.now() };
  }

  async findRoom(code: string) {
    const room = this.rooms.get(code);
    return room ? structuredClone(room) : null;
  }

  async isCodeTaken(code: string) {
    return this.rooms.has(code);
  }

  async listRooms() { return structuredClone([...this.rooms.values()]); }
  async findMembership(key: string) {
    return [...this.rooms.values()].find((r) => r.participants.some((p) => p.key === key))?.code ?? null;
  }
  async findInviteRoom(tokenHash: string) {
    return [...this.rooms.values()].find((r) => r.invites.some((i) => i.tokenHash === tokenHash))?.code ?? null;
  }

  async createRoom(code: string, host: Identity, isSpectator = false) {
    if (this.rooms.has(code)) throw new CodeTakenError(code);
    const current = [...this.rooms.values()].find((r) => r.participants.some((p) => p.key === host.key))?.code;
    if (current) throw new MembershipConflictError(current);
    const room: Room = {
      code,
      status: "EN_ATTENTE",
      hostKey: host.key,
      createdAt: this.now(),
      participants: [this.participant(host, isSpectator)],
      capacity: 8,
      visibility: "PUBLIQUE",
      invites: [],
      bannedKeys: [],
      config: { ...defaultRaceConfig },
      bots: [],
    };
    this.rooms.set(code, room);
    return structuredClone(room);
  }

  async withRoom<T>(code: string, fn: (room: Room | null, locked: LockedRoom) => Promise<T>) {
    const previous = this.locks.get(code);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    this.locks.set(code, gate);
    await previous;
    const room = this.rooms.get(code);
    const locked: LockedRoom = {
      addParticipant: async (identity, isSpectator = false) => {
        const current = [...this.rooms.values()].find((r) => r.participants.some((p) => p.key === identity.key))?.code;
        if (current) throw new MembershipConflictError(current);
        const p = this.participant(identity, isSpectator);
        room!.participants.push(p);
        return p;
      },
      removeParticipant: async (key) => {
        room!.participants = room!.participants.filter((p) => p.key !== key);
      },
      setHost: async (key) => {
        room!.hostKey = key;
      },
      setStatus: async (status) => { room!.status = status; },
      setConfig: async (config) => { room!.config = { ...config }; },
      setAccess: async (visibility, capacity) => { Object.assign(room!, { visibility, capacity }); },
      addInvite: async (tokenHash) => {
        const invite = { id: `i${this.nextId++}`, tokenHash, usedByKey: null, usedByName: null, usedIp: null, usedAt: null, revokedAt: null };
        room!.invites.push(invite);
        return structuredClone(invite);
      },
      useInvite: async (id, identity, ip) => {
        Object.assign(room!.invites.find((i) => i.id === id)!, { usedByKey: identity.key, usedByName: identity.displayName, usedIp: ip, usedAt: this.now() });
      },
      ban: async (key) => {
        room!.bannedKeys.push(key);
        room!.invites.filter((i) => i.usedByKey === key).forEach((i) => { i.revokedAt = this.now(); });
      },
      addBot: async (level, name) => { room!.bots.push({ id: `b${this.nextId++}`, level, name }); },
      removeBot: async (id) => { room!.bots = room!.bots.filter((bot) => bot.id !== id); },
      deleteRoom: async () => {
        this.rooms.delete(code);
      },
    };
    const snapshot = room ? structuredClone(room) : null;
    try {
      return await fn(snapshot, locked);
    } finally {
      release();
      if (this.locks.get(code) === gate) this.locks.delete(code);
    }
  }
}
