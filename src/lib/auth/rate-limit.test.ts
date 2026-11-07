import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rate-limit";

describe("limiteur de tentatives", () => {
  it("accepte le quota puis refuse les tentatives suivantes", () => {
    const limiter = createRateLimiter(() => 0);
    for (let i = 0; i < 20; i++) expect(limiter.consume("ip", 20, 600_000)).toBe(true);
    expect(limiter.consume("ip", 20, 600_000)).toBe(false);
  });

  it("rouvre le quota à l'expiration sans prolonger la fenêtre en cas de refus", () => {
    let now = 0;
    const limiter = createRateLimiter(() => now);
    expect(limiter.consume("ip", 1, 100)).toBe(true);
    now = 99;
    expect(limiter.consume("ip", 1, 100)).toBe(false);
    now = 100;
    expect(limiter.consume("ip", 1, 100)).toBe(true);
  });

  it("garde les clés indépendantes", () => {
    const limiter = createRateLimiter(() => 0);
    expect(limiter.consume("alice", 1, 100)).toBe(true);
    expect(limiter.consume("alice", 1, 100)).toBe(false);
    expect(limiter.consume("bob", 1, 100)).toBe(true);
  });

  it("consulte sans incrémenter, réinitialise une clé et respecte son expiration", () => {
    let now = 0;
    const limiter = createRateLimiter(() => now);
    expect(limiter.isLimited("alice", 1)).toBe(false);
    limiter.consume("alice", 1, 100);
    expect(limiter.isLimited("alice", 1)).toBe(true);
    limiter.reset("alice");
    expect(limiter.isLimited("alice", 1)).toBe(false);
    limiter.consume("alice", 1, 100);
    now = 100;
    expect(limiter.isLimited("alice", 1)).toBe(false);
  });

  it("purge les clés expirées, y compris lors d'une nouvelle tentative", () => {
    let now = 0;
    const limiter = createRateLimiter(() => now);
    limiter.consume("court", 1, 1_000);
    limiter.consume("long", 1, 2_000);
    now = 1_000;
    limiter.purge();
    expect(limiter.size).toBe(1);
    now = 2_000;
    limiter.consume("nouveau", 1, 1_000);
    expect(limiter.size).toBe(1);
    now = 3_000;
    limiter.purge();
    expect(limiter.size).toBe(0);
  });

  it("ne purge qu'une fois par seconde malgré les consommations et appels explicites", () => {
    let now = 0;
    const limiter = createRateLimiter(() => now);
    limiter.consume("expire", 1, 100);
    now = 100;
    limiter.consume("actif", 1, 5_000);
    limiter.purge();
    expect(limiter.size).toBe(2);
    now = 999;
    limiter.purge();
    expect(limiter.size).toBe(2);
    now = 1_000;
    limiter.purge();
    expect(limiter.size).toBe(1);
    now = 1_100;
    limiter.consume("court", 1, 100);
    now = 1_200;
    limiter.consume("autre", 1, 5_000);
    expect(limiter.size).toBe(3);
    now = 2_000;
    limiter.purge();
    expect(limiter.size).toBe(2);
  });
});

describe("clientIp", () => {
  it("privilégie la dernière valeur de x-forwarded-for à x-real-ip", () => {
    expect(clientIp(new Headers({
      "x-real-ip": " 203.0.113.1 ",
      "x-forwarded-for": "falsifie, 203.0.113.2",
    }))).toBe("203.0.113.2");
  });

  it("se replie sur x-real-ip sans x-forwarded-for exploitable", () => {
    expect(clientIp(new Headers({ "x-real-ip": " 203.0.113.1 " }))).toBe("203.0.113.1");
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.1", "x-forwarded-for": "falsifie, " })))
      .toBe("203.0.113.1");
  });

  it("ne prend que la dernière valeur de x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "falsifie, 203.0.113.2, 2001:db8::1" })))
      .toBe("2001:db8::1");
  });

  it("utilise local sans en-tête exploitable", () => {
    expect(clientIp(new Headers())).toBe("local");
    expect(clientIp(new Headers({ "x-real-ip": " ", "x-forwarded-for": "falsifie, " })))
      .toBe("local");
  });
});
