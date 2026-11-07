import type { Identity, Participant, RaceConfig, Room, RoomBot, RoomInvite, RoomStatus, RoomVisibility } from "./types";

/** Opérations possibles sur une salle verrouillée (voir RoomStore.withRoom). */
export interface LockedRoom {
  addParticipant(identity: Identity, isSpectator?: boolean): Promise<Participant>;
  removeParticipant(key: string): Promise<void>;
  setHost(key: string): Promise<void>;
  setStatus(status: RoomStatus): Promise<void>;
  setConfig(config: RaceConfig): Promise<void>;
  setAccess(visibility: RoomVisibility, capacity: number): Promise<void>;
  addInvite(tokenHash: string): Promise<RoomInvite>;
  useInvite(id: string, identity: Identity, ip: string): Promise<void>;
  ban(key: string): Promise<void>;
  addBot(level: RoomBot["level"], name: string): Promise<void>;
  removeBot(id: string): Promise<void>;
  deleteRoom(): Promise<void>;
}

/** Accès aux salles. Implémenté avec Prisma (prisma-store.ts) et en mémoire pour les tests. */
export interface RoomStore {
  findRoom(code: string): Promise<Room | null>;
  listRooms(): Promise<Room[]>;
  findMembership(key: string): Promise<string | null>;
  findInviteRoom(tokenHash: string): Promise<string | null>;
  isCodeTaken(code: string): Promise<boolean>;
  /** Crée la salle et son hôte. Lève CodeTakenError si le code vient d'être pris. */
  createRoom(code: string, host: Identity, isSpectator: boolean): Promise<Room>;
  /**
   * Exécute `fn` avec la salle verrouillée : deux arrivées ou départs simultanés
   * dans la même salle sont traités l'un après l'autre.
   */
  withRoom<T>(code: string, fn: (room: Room | null, locked: LockedRoom) => Promise<T>): Promise<T>;
}

export class MembershipConflictError extends Error {
  constructor(public readonly currentCode: string | null) { super("alreadyInRoom"); }
}

export class CodeTakenError extends Error {
  constructor(code: string) {
    super(`Le code de salle ${code} est déjà utilisé.`);
  }
}
