import { normalizeRoomCode, validateRoomCode } from "@/lib/rooms/code";
import { roomStore } from "@/lib/rooms/prisma-store";
import { leaveRoom, toPublicRoom } from "@/lib/rooms/service";
import type { Identity } from "@/lib/rooms/types";
import { publishRoom, roomChannel, type RealtimeServer } from "./realtime";
import { identityFromCookieHeader } from "./socket-identity";

/**
 * Délai avant de considérer qu'un participant déconnecté a quitté la salle (ADR 0006).
 * Couvre un rechargement de page ou une courte coupure réseau.
 */
export const DEPARTURE_GRACE_MS = 30_000;

type SocketData = { identity: Identity; watched: Set<string> };

export function registerRoomHandlers(io: RealtimeServer): void {
  const departures = new Map<string, NodeJS.Timeout>();
  const departureKey = (code: string, key: string) => `${code}|${key}`;

  async function isStillConnected(code: string, key: string): Promise<boolean> {
    const sockets = await io.in(roomChannel(code)).fetchSockets();
    return sockets.some((s) => (s.data as SocketData).identity?.key === key);
  }

  function cancelDeparture(code: string, key: string) {
    const id = departureKey(code, key);
    clearTimeout(departures.get(id));
    departures.delete(id);
  }

  function scheduleDeparture(code: string, key: string) {
    cancelDeparture(code, key);
    const timer = setTimeout(async () => {
      departures.delete(departureKey(code, key));
      try {
        if (await isStillConnected(code, key)) return;
        if ((await leaveRoom(roomStore, code, key)) !== "not-in-room") await publishRoom(code);
      } catch (error) {
        console.error(`> Départ automatique impossible (${code}) :`, error);
      }
    }, DEPARTURE_GRACE_MS);
    departures.set(departureKey(code, key), timer);
  }

  // L'identité vient uniquement du cookie de session Auth.js (ADR 0007).
  io.use(async (socket, next) => {
    try {
      const identity = await identityFromCookieHeader(socket.request.headers.cookie);
      if (!identity) return next(new Error("non-authentifie"));
      socket.data = { identity, watched: new Set<string>() } satisfies SocketData;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("erreur-authentification"));
    }
  });

  io.on("connection", (socket) => {
    const data = socket.data as SocketData;

    socket.on("room:watch", async (payload, ack) => {
      if (typeof ack !== "function") return;
      try {
        const code = normalizeRoomCode(String(payload?.code ?? ""));
        if (validateRoomCode(code)) return ack({ ok: false, error: "roomCodeInvalid" });
        const room = await roomStore.findRoom(code);
        if (!room) return ack({ ok: false, error: "roomClosed" });
        const self = room.participants.find((p) => p.key === data.identity.key);
        if (!self) {
          return ack({ ok: false, error: "notInRoom" });
        }
        cancelDeparture(code, data.identity.key);
        data.watched.add(code);
        await socket.join(roomChannel(code));
        ack({ ok: true, room: toPublicRoom(room), selfId: self.id });
      } catch (error) {
        console.error("> room:watch :", error);
        ack({ ok: false, error: "serverError" });
      }
    });

    socket.on("disconnect", async () => {
      for (const code of data.watched) {
        // Un autre onglet de la même personne est encore là : rien à faire.
        if (await isStillConnected(code, data.identity.key)) continue;
        scheduleDeparture(code, data.identity.key);
      }
    });
  });

  // Après un redémarrage (déploiement), les minuteries sont perdues : chaque participant
  // enregistré a le délai de grâce pour se reconnecter, sinon il est retiré de la salle.
  roomStore
    .listMemberships()
    .then((memberships) => memberships.forEach(({ code, key }) => scheduleDeparture(code, key)))
    .catch((error) => console.error("> Lecture des salles au démarrage impossible :", error));
}
