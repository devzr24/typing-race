import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "@/lib/auth/rate-limit";
import { consumeCodeAttempt } from "./code-rate-limit";

describe("limiteur des codes de salle", () => {
  it("autorise 10 tentatives par minute et par IP, puis se renouvelle", () => {
    let now = 0;
    const limiter = createRateLimiter(() => now);
    for (let i = 0; i < 10; i++) expect(consumeCodeAttempt("ip-1", limiter)).toBe(true);
    expect(consumeCodeAttempt("ip-1", limiter)).toBe(false);
    expect(consumeCodeAttempt("ip-2", limiter)).toBe(true);
    now = 60_000;
    expect(consumeCodeAttempt("ip-1", limiter)).toBe(true);
  });

  it("utilise la dernière adresse X-Forwarded-For, puis X-Real-IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "forged, proxy", "x-real-ip": "fallback" }))).toBe("proxy");
    expect(clientIp(new Headers({ "x-real-ip": "fallback" }))).toBe("fallback");
  });
});
