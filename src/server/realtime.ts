import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/rooms/events";
import { roomStore } from "@/lib/rooms/prisma-store";
import { toPublicRoom } from "@/lib/rooms/service";

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents>;

// server.ts et le code de Next.js (actions serveur) tournent dans le même processus Node
// mais chargent leurs modules séparément : l'instance Socket.IO est partagée via globalThis.
const IO_KEY = Symbol.for("typing-race.socket-io");
type GlobalWithIO = typeof globalThis & { [IO_KEY]?: RealtimeServer };

export function setRealtimeServer(io: RealtimeServer): void {
  (globalThis as GlobalWithIO)[IO_KEY] = io;
}

export function getRealtimeServer(): RealtimeServer | undefined {
  return (globalThis as GlobalWithIO)[IO_KEY];
}

export function roomChannel(code: string): string {
  return `room:${code}`;
}

/** Envoie la liste à jour des participants à tous ceux qui regardent la salle. */
export async function publishRoom(code: string): Promise<void> {
  const io = getRealtimeServer();
  if (!io) return;
  const room = await roomStore.findRoom(code);
  io.to(roomChannel(code)).emit("room:update", room ? toPublicRoom(room) : null);
}
