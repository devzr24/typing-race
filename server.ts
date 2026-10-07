import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { getPort } from "./src/server/config";
import { assertProductionEnv } from "./src/server/env";
import type { RealtimeServer } from "./src/server/realtime";

const port = getPort();
// 0.0.0.0 : écoute sur toutes les interfaces, obligatoire dans le conteneur Railway.
const hostname = "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

// Un seul serveur HTTP : Next.js gère les pages, Socket.IO gère /socket.io/.
const httpServer = createServer();
// hostname n'est pas transmis à Next : il s'en servirait pour construire ses URL (http://0.0.0.0…).
const app = next({ dev, port, httpServer });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Arrêt immédiat et explicite si une variable obligatoire manque en production.
  assertProductionEnv();

  httpServer.on("request", (req, res) => {
    handle(req, res);
  });

  // Importés après prepare() : Next.js vient de charger .env (DATABASE_URL, AUTH_SECRET).
  const { setRealtimeServer } = await import("./src/server/realtime");
  const { registerRoomHandlers } = await import("./src/server/room-socket");

  // Socket.IO intercepte les requêtes /socket.io/ avant Next.js.
  // destroyUpgrade: false laisse passer les autres WebSockets (rechargement à chaud de Next en dev).
  const io: RealtimeServer = new SocketIOServer(httpServer, { destroyUpgrade: false });
  setRealtimeServer(io);
  registerRoomHandlers(io);

  httpServer.listen(port, hostname, () => {
    console.log(
      `> Serveur prêt sur http://localhost:${port} (${dev ? "développement" : "production"})`,
    );
  });
}).catch((error: unknown) => {
  // Code de sortie 1 : Railway marque le déploiement en échec au lieu d'un arrêt « normal ».
  console.error("> Démarrage impossible :", error instanceof Error ? error.message : error);
  process.exit(1);
});
