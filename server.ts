import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { getPort } from "./src/server/config";

const port = getPort();
const dev = process.env.NODE_ENV !== "production";

// Un seul serveur HTTP : Next.js gère les pages, Socket.IO gère /socket.io/.
const httpServer = createServer();
const app = next({ dev, port, httpServer });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  httpServer.on("request", (req, res) => {
    handle(req, res);
  });

  // Socket.IO intercepte les requêtes /socket.io/ avant Next.js.
  // destroyUpgrade: false laisse passer les autres WebSockets (rechargement à chaud de Next en dev).
  const io = new SocketIOServer(httpServer, { destroyUpgrade: false });

  io.on("connection", (socket) => {
    console.log(`> Socket connecté : ${socket.id}`);
    socket.on("disconnect", (reason) => {
      console.log(`> Socket déconnecté : ${socket.id} (${reason})`);
    });
  });

  httpServer.listen(port, () => {
    console.log(
      `> Serveur prêt sur http://localhost:${port} (${dev ? "développement" : "production"})`,
    );
  });
});
