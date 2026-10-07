import type { Identity, Participant, Room } from "./types";

/** Opérations possibles sur une salle verrouillée (voir RoomStore.withRoom). */
export interface LockedRoom {
  addParticipant(identity: Identity): Promise<Participant>;
  removeParticipant(key: string): Promise<void>;
  setHost(key: string): Promise<void>;
  deleteRoom(): Promise<void>;
}

/** Accès aux salles. Implémenté avec Prisma (prisma-store.ts) et en mémoire pour les tests. */
export interface RoomStore {
  findRoom(code: string): Promise<Room | null>;
  isCodeTaken(code: string): Promise<boolean>;
  /** Crée la salle et son hôte. Lève CodeTakenError si le code vient d'être pris. */
  createRoom(code: string, host: Identity): Promise<Room>;
  /**
   * Exécute `fn` avec la salle verrouillée : deux arrivées ou départs simultanés
   * dans la même salle sont traités l'un après l'autre.
   */
  withRoom<T>(code: string, fn: (room: Room | null, locked: LockedRoom) => Promise<T>): Promise<T>;
}

export class CodeTakenError extends Error {
  constructor(code: string) {
    super(`Le code de salle ${code} est déjà utilisé.`);
  }
}
