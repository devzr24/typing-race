import type { ErrorCode } from "@/i18n/messages";
import type { CreatedInvite, LobbyRoom, PublicInvite, PublicRoom } from "./types";
import type { HostCommand } from "./schemas";

export type CommandResponse = { ok: true; invites?: PublicInvite[]; createdInvites?: CreatedInvite[] } | { ok: false; error: ErrorCode };

// Événements Socket.IO échangés entre le navigateur et le serveur (typés des deux côtés).

export type WatchResponse =
  | { ok: true; room: PublicRoom; selfId: string }
  | { ok: false; error: ErrorCode };

export interface ServerToClientEvents {
  /** Nouvelle liste des participants ; null si la salle a été fermée. */
  "room:update": (room: PublicRoom | null) => void;
  "room:removed": (error: "roomKicked" | "noLongerInRoom") => void;
  "lobby:update": (rooms: LobbyRoom[]) => void;
}

export interface ClientToServerEvents {
  "lobby:watch": (ack: (rooms: LobbyRoom[]) => void) => void;
  "room:command": (payload: { code: string; command: HostCommand }, ack: (response: CommandResponse) => void) => void;
  /** S'abonne aux mises à jour d'une salle dont on fait déjà partie. */
  "room:watch": (payload: { code: string }, ack: (response: WatchResponse) => void) => void;
}
