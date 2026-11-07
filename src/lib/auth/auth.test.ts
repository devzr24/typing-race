import { Auth, customFetch, raw, skipCSRFCheck } from "@auth/core";
import { CredentialsSignin } from "@auth/core/errors";
import GitHub from "@auth/core/providers/github";
import type { NextAuthConfig } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/auth";
import { ScryptQueueFullError } from "./password";

const state = vi.hoisted(() => ({
  config: undefined as NextAuthConfig | undefined,
  user: {
    findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), count: vi.fn(), create: vi.fn(),
  },
  account: { findUnique: vi.fn(), create: vi.fn() },
  verify: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("next-auth", () => ({
  CredentialsSignin,
  default: (config: NextAuthConfig) => {
    state.config = config;
    return {};
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { user: state.user, account: state.account } }));
vi.mock("./password", async (importOriginal) => ({
  ...await importOriginal<typeof import("./password")>(),
  hashPassword: state.hash,
  verifyPassword: state.verify,
}));

const user = { id: "user-id", username: "alice", passwordHash: "hash", name: null, image: null };

function config() {
  return { ...state.config!, secret: "secret-de-test-pour-auth", basePath: "/api/auth" };
}

function login(username: string, ip: string, serverAction = false) {
  return Auth(new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": ip },
    body: new URLSearchParams({ username, password: "motdepasse" }),
  }), { ...config(), skipCSRFCheck, ...(serverAction ? { raw } : {}) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.user.findUnique.mockResolvedValue(user);
  state.verify.mockResolvedValue(false);
  state.hash.mockResolvedValue("dummy-hash");
});

afterEach(() => vi.restoreAllMocks());

describe("authorize credentials", () => {
  it("limite aussi les POST directs par nom normalisé avant tout hachage", async () => {
    for (let i = 0; i < 10; i++) await login(" Alice ", `username-ip-${i}`);
    const response = await login("ALICE", "username-ip-11");
    expect(response.headers.get("location"))
      .toBe("http://localhost/login?error=CredentialsSignin&code=rate_limited");
    expect(state.verify).toHaveBeenCalledTimes(10);
    expect(state.user.findUnique).toHaveBeenCalledTimes(10);
  });

  it("limite l'IP même si le nom change", async () => {
    for (let i = 0; i < 20; i++) await login(`joueur-${i}`, "same-ip");
    const response = await login("autre-joueur", "same-ip");
    expect(response.headers.get("location")).toContain("code=rate_limited");
    expect(state.verify).toHaveBeenCalledTimes(20);
  });

  it("ne compte pas les connexions réussies par nom", async () => {
    state.verify.mockResolvedValue(true);
    for (let i = 0; i < 12; i++) {
      const response = await login("succes", `succes-ip-${i}`);
      expect(response.headers.get("location")).toBe("http://localhost");
    }
    expect(state.verify).toHaveBeenCalledTimes(12);
  });

  it("remet les échecs à zéro après un succès et bloque au dixième nouvel échec", async () => {
    for (let i = 0; i < 9; i++) await login("reset", `avant-reset-ip-${i}`);
    state.verify.mockResolvedValueOnce(true);
    expect((await login("reset", "reset-succes-ip")).headers.get("location"))
      .toBe("http://localhost");
    for (let i = 0; i < 10; i++) {
      const response = await login("reset", `apres-reset-ip-${i}`);
      expect(response.headers.get("location")).toContain("code=invalid_login");
    }
    const response = await login("reset", "reset-bloque-ip");
    expect(response.headers.get("location")).toContain("code=rate_limited");
    expect(state.verify).toHaveBeenCalledTimes(20);
    expect(state.user.findUnique).toHaveBeenCalledTimes(20);
  });

  it("conserve CredentialsSignin et son code pour l'action serveur quand scrypt est saturé", async () => {
    state.verify.mockRejectedValueOnce(new ScryptQueueFullError());
    await expect(login("sature", "sature-ip", true)).rejects.toMatchObject({
      type: "CredentialsSignin", code: "rate_limited",
    });
  });
});

describe("liaison OAuth", () => {
  async function callback(signedIn: boolean) {
    const provider = state.config!.providers[0];
    if (typeof provider === "function" || provider.type !== "oauth") throw new Error("Fournisseur inattendu");
    return Auth(new Request("http://localhost/api/auth/callback/github?code=test", {
      headers: signedIn ? { cookie: "authjs.session-token=session-test" } : {},
    }), {
      ...config(),
      jwt: { decode: async () => ({ sub: user.id }) },
      providers: [GitHub({
        ...provider.options,
        clientId: "test", clientSecret: "test", checks: ["none"],
        [customFetch]: async () => Response.json({ access_token: "test", token_type: "bearer" }),
        userinfo: {
          url: "https://api.github.com/user",
          request: async () => ({ id: 123, login: "nouveau" }),
        },
      })],
    });
  }

  it.each([
    { passwordHash: "hash", _count: { accounts: 0 } },
    { passwordHash: null, _count: { accounts: 1 } },
  ])("renvoie réellement OAuthAccountNotLinked dans l'URL pour %j", async (target) => {
    state.account.findUnique.mockResolvedValue(null);
    state.user.findUniqueOrThrow.mockResolvedValue(target);
    const response = await callback(true);
    expect(response.headers.get("location"))
      .toBe("http://localhost/login?error=OAuthAccountNotLinked");
    expect(state.account.create).not.toHaveBeenCalled();
  });

  it("laisse un nouvel utilisateur OAuth créer son premier compte", async () => {
    state.account.findUnique.mockResolvedValue(null);
    state.user.count.mockResolvedValue(0);
    state.user.create.mockResolvedValue({ ...user, passwordHash: null });
    state.user.findUniqueOrThrow.mockResolvedValue({ passwordHash: null, _count: { accounts: 0 } });
    const response = await callback(false);
    expect(response.headers.get("location")).toBe("http://localhost");
    expect(state.account.create).toHaveBeenCalledOnce();
  });
});
