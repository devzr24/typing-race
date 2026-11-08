import { raceAbandonSchema, raceInputSchema, roomCommandSchema, roomWatchSchema } from "@/lib/rooms/schemas";
import { roomStore } from "@/lib/rooms/prisma-store";
import { executeHostCommand, leaveRoom, listLobbyRooms, toPublicRoom } from "@/lib/rooms/service";
import type { Identity } from "@/lib/rooms/types";
import { connectedRoomKeys, publishRoom, raceSelfChannel, removeRoomSockets, roomChannel, type RealtimeServer } from "./realtime";
import { identityFromCookieHeader } from "./socket-identity";
import { activeRaces } from "@/lib/rooms/race-memory";
import { raceSelf, raceSnapshot } from "@/lib/race/engine";

/**
 * Délai avant de considérer qu'un participant déconnecté a quitté la salle (ADR 0006).
 * Couvre un rechargement de page ou une courte coupure réseau.
 */
export const DEPARTURE_GRACE_MS = 30_000;

type SocketData = { identity: Identity | null; watched: Set<string> };

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
        if ((await leaveRoom(roomStore, code, key, await connectedRoomKeys(code))) !== "not-in-room") await publishRoom(code);
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
      socket.data = { identity, watched: new Set<string>() } satisfies SocketData;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("erreur-authentification"));
    }
  });

  io.on("connection", (socket) => {
    const data = socket.data as SocketData;

    socket.on("race:input", (payload, ack) => {
      if (typeof ack !== "function") return;
      try {
        const parsed = raceInputSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "raceInputInvalid" });
        if (!data.identity) return ack({ ok: false, error: "loginRequired" });
        const race = activeRaces.get(parsed.data.code);
        const session = race?.sessions?.get(data.identity.key);
        if (!race?.runtime || !session || race.results
          || !race.state?.racers.some((r) => r.id === session.id && r.status === "racing")) {
          return ack({ ok: false, error: "raceNotRacing" });
        }
        const now = Date.now();
        session.inputTimes = session.inputTimes.filter((time) => now - time < 1000);
        if (session.inputTimes.length >= 10) return ack({ ok: false, error: "raceTooFast" });
        session.inputTimes.push(now);
        if (parsed.data.seq <= session.sequence) return ack({ ok: false, error: "raceSequenceInvalid" });
        const result = race.runtime.input(session.id, parsed.data.keys);
        if (!result.ok) return ack(result);
        session.sequence = parsed.data.seq;
        ack({ ok: true, position: result.position, errors: result.errors });
      } catch (error) {
        console.error("> race:input", error);
        ack({ ok: false, error: "serverError" });
      }
    });

    socket.on("race:abandon", async (payload, ack) => {
      if (typeof ack !== "function") return;
      try {
        const parsed = raceAbandonSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "roomCodeInvalid" });
        const identity = await identityFromCookieHeader(socket.request.headers.cookie);
        if (!identity || identity.key !== data.identity?.key) return ack({ ok: false, error: "loginRequired" });
        await roomStore.withRoom(parsed.data.code, async (room) => {
          const participant = room?.participants.find((p) => p.key === identity.key);
          if (!participant || room?.bannedKeys.includes(identity.key)) return ack({ ok: false, error: "notInRoom" });
          if (participant.isSpectator || room?.status !== "EN_COURSE"
            || !activeRaces.get(parsed.data.code)?.runtime?.abandon(participant.id)) return ack({ ok: false, error: "raceNotRacing" });
          ack({ ok: true });
        });
      } catch (error) {
        console.error("> race:abandon", error);
        ack({ ok: false, error: "serverError" });
      }
    });

    socket.on("lobby:watch", async (ack) => {
      if (typeof ack !== "function") return;
      try {
        await socket.join("lobby");
        ack(await listLobbyRooms(roomStore));
      } catch (error) { console.error("> lobby:watch", error); }
    });

    socket.on("room:command", async (payload, ack) => {
      if (typeof ack !== "function") return;
      try {
        const parsed = roomCommandSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "roomConfigInvalid" });
        // Relire la session : une connexion ouverte ne prolonge pas une session expirée.
        const identity = await identityFromCookieHeader(socket.request.headers.cookie);
        if (!identity || identity.key !== data.identity?.key) return ack({ ok: false, error: "loginRequired" });
        const result = await executeHostCommand(roomStore, parsed.data.code, identity, parsed.data.command, publishRoom);
        if (result.ok) {
          if (result.kickedKey) await removeRoomSockets(parsed.data.code, result.kickedKey, "roomKicked");
          ack({ ok: true, invites: result.invites, createdInvites: result.createdInvites });
        } else ack(result);
      } catch (error) {
        console.error("> room:command :", error);
        ack({ ok: false, error: "serverError" });
      }
    });

    socket.on("room:watch", async (payload, ack) => {
      if (typeof ack !== "function") return;
      try {
        const parsed = roomWatchSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "roomCodeInvalid" });
        const { code } = parsed.data;
        const identity = await identityFromCookieHeader(socket.request.headers.cookie);
        if (!identity || identity.key !== data.identity?.key) return ack({ ok: false, error: "loginRequired" });
        // Même verrou que l'expulsion : aucun socket banni ne peut s'abonner entre retrait et diffusion.
        await roomStore.withRoom(code, async (room) => {
          if (!room) return ack({ ok: false, error: "roomClosed" });
          if (room.bannedKeys.includes(identity.key)) return ack({ ok: false, error: "roomBanned" });
          const self = room.participants.find((p) => p.key === identity.key);
          if (!self) return ack({ ok: false, error: "notInRoom" });
          cancelDeparture(code, identity.key);
          data.watched.add(code);
          await socket.join(roomChannel(code));
          if (!self.isSpectator) await socket.join(raceSelfChannel(code, self.id));
          const state = activeRaces.get(code)?.state;
          const currentSelf = state && !self.isSpectator ? raceSelf(state, self.id) : undefined;
          ack({ ok: true, room: toPublicRoom(room), selfId: self.id, ...(currentSelf ? { self: currentSelf } : {}),
            ...(state && room.status === "EN_COURSE" ? { raceSnapshot: raceSnapshot(state, Date.now()) } : {}),
          });
        });
      } catch (error) {
        console.error("> room:watch :", error);
        ack({ ok: false, error: "serverError" });
      }
    });

    socket.on("disconnect", async () => {
      if (!data.identity) return;
      for (const code of data.watched) {
        // Un autre onglet de la même personne est encore là : rien à faire.
        if (await isStillConnected(code, data.identity.key)) continue;
        scheduleDeparture(code, data.identity.key);
      }
    });
  });

  // Après un redémarrage (déploiement), les minuteries sont perdues : chaque participant
  // enregistré a le délai de grâce pour se reconnecter, sinon il est retiré de la salle.
  // Les courses en cours sont perdues avec la mémoire : leurs salles reviennent en attente.
  roomStore
    .resetInterruptedRaces()
    .then(() => roomStore.listMemberships())
    .then((memberships) => memberships.forEach(({ code, key }) => scheduleDeparture(code, key)))
    .catch((error) => console.error("> Lecture des salles au démarrage impossible :", error));
}
