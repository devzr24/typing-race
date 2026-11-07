import { authRateLimiter } from "@/lib/auth/rate-limit";

/** À appeler avant auth(), la validation et toute lecture de salle. */
export function consumeCodeAttempt(ip: string, limiter = authRateLimiter): boolean {
  return limiter.consume(`room:code:ip:${ip}`, 10, 60_000);
}
