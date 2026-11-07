import type { ErrorCode } from "@/i18n/messages";
import type { PublicRoom } from "./types";
import type { HostCommand } from "./schemas";

export type CommandResponse = { ok: true } | { ok: false; error: ErrorCode };

// Événements Socket.IO échangés entre le navigateur et le serveur (typés des deux côtés).

export type WatchResponse =
  | { ok: true; room: PublicRoom; selfId: string }
  | { ok: false; error: ErrorCode };

export interface ServerToClientEvents {
  /** Nouvelle liste des participants ; null si la salle a été fermée. */
  "room:update": (room: PublicRoom | null) => void;
}

export interface ClientToServerEvents {
  "room:command": (payload: { code: string; command: HostCommand }, ack: (response: CommandResponse) => void) => void;
  /** S'abonne aux mises à jour d'une salle dont on fait déjà partie. */
  "room:watch": (payload: { code: string }, ack: (response: WatchResponse) => void) => void;
}
