import { encode } from "next-auth/jwt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { identityFromCookieHeader } from "./socket-identity";

const SECRET = "secret-de-test-uniquement-pour-vitest";
const previousSecret = process.env.AUTH_SECRET;

beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});
afterAll(() => {
  process.env.AUTH_SECRET = previousSecret;
});

async function sessionCookie(name: string, payload: Record<string, unknown>, secret = SECRET) {
  const token = await encode({ token: payload, secret, salt: name });
  return `autre=1; ${name}=${token}`;
}

describe("identityFromCookieHeader", () => {
  it("lit un utilisateur depuis le cookie de session (HTTP)", async () => {
    const cookie = await sessionCookie("authjs.session-token", {
      sub: "u-alice",
      username: "alice",
      picture: "https://x/a.png",
      isGuest: false,
    });
    expect(await identityFromCookieHeader(cookie)).toEqual({
      key: "u-alice",
      displayName: "alice",
      image: "https://x/a.png",
      isGuest: false,
    });
  });

  it("lit un invité depuis le cookie sécurisé (HTTPS)", async () => {
    const cookie = await sessionCookie("__Secure-authjs.session-token", {
      sub: "guest-123",
      username: "invite-4821",
      isGuest: true,
    });
    expect(await identityFromCookieHeader(cookie)).toMatchObject({
      key: "guest-123",
      displayName: "invite-4821",
      isGuest: true,
    });
  });

  it("refuse l'absence de cookie", async () => {
    expect(await identityFromCookieHeader(undefined)).toBeNull();
    expect(await identityFromCookieHeader("autre=1")).toBeNull();
  });

  it("refuse un cookie chiffré avec un autre secret (usurpation)", async () => {
    const cookie = await sessionCookie(
      "authjs.session-token",
      { sub: "u-alice", username: "alice" },
      "un-autre-secret-que-celui-du-serveur",
    );
    expect(await identityFromCookieHeader(cookie)).toBeNull();
  });

  it("refuse un cookie modifié", async () => {
    const cookie = await sessionCookie("authjs.session-token", { sub: "u-alice", username: "alice" });
    const tampered = cookie.slice(0, -4) + (cookie.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(await identityFromCookieHeader(tampered)).toBeNull();
  });
});
