const DEFAULT_PORT = 3000;

/** Lit le port depuis l'environnement (Railway fournit PORT), 3000 par défaut. */
export function getPort(env: Record<string, string | undefined> = process.env): number {
  const port = Number.parseInt(env.PORT ?? "", 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}
