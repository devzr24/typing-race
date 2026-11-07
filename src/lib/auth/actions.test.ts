import { AuthError, CredentialsSignin } from "@auth/core/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { continueAsGuest, loginWithPassword, register, signInWithProvider } from "./actions";
import { ScryptQueueFullError } from "./password";

const state = vi.hoisted(() => ({
  signIn: vi.fn(),
  create: vi.fn(),
  hash: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/auth", () => ({ signIn: state.signIn, signOut: vi.fn() }));
vi.mock("next-auth", () => ({ AuthError, CredentialsSignin }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { create: state.create } } }));
vi.mock("next/headers", () => ({ headers: state.headers }));
vi.mock("./password", async (importOriginal) => ({
  ...await importOriginal<typeof import("./password")>(),
  hashPassword: state.hash,
}));

function form() {
  const data = new FormData();
  data.set("username", "alice");
  data.set("password", "motdepasse");
  data.set("confirm", "motdepasse");
  return data;
}

function rateLimitedError() {
  const error = new CredentialsSignin();
  error.code = "rate_limited";
  return error;
}

beforeEach(() => {
  vi.resetAllMocks();
  state.hash.mockResolvedValue("hash");
  state.headers.mockResolvedValue(new Headers({ "x-real-ip": "register-test-ip" }));
});

describe("erreurs des actions d'authentification", () => {
  it.each(["", "ab", "a".repeat(21)])("refuse le pseudo invité %j avant signIn", async (pseudo) => {
    const data = new FormData();
    data.set("pseudo", pseudo);
    expect((await continueAsGuest({}, data)).fieldErrors?.pseudo)
      .toBe(pseudo ? "guestPseudoLength" : "required");
    expect(state.signIn).not.toHaveBeenCalled();
  });

  it("connecte un invité avec son pseudo normalisé", async () => {
    const data = new FormData();
    data.set("pseudo", " Alice ");
    await continueAsGuest({}, data);
    expect(state.signIn).toHaveBeenCalledWith("guest", { pseudo: "alice", redirectTo: "/" });
  });

  it("ignore un fournisseur inconnu", async () => {
    const data = new FormData();
    data.set("provider", "inconnu");
    await signInWithProvider(data);
    expect(state.signIn).not.toHaveBeenCalled();
  });

  it("traduit le code CredentialsSignin de saturation", async () => {
    state.signIn.mockRejectedValueOnce(rateLimitedError());
    expect(await loginWithPassword({}, form())).toEqual({
      error: "tooManyAttempts", values: { username: "alice" },
    });
  });

  it("garde invalidLogin pour des identifiants incorrects", async () => {
    state.signIn.mockRejectedValueOnce(new CredentialsSignin());
    expect((await loginWithPassword({}, form())).error).toBe("invalidLogin");
  });

  it("refuse la sixième inscription de l'IP avant de hacher", async () => {
    for (let i = 0; i < 5; i++) await register({}, form());
    expect((await register({}, form())).error).toBe("tooManyAttempts");
    expect(state.hash).toHaveBeenCalledTimes(5);
    expect(state.create).toHaveBeenCalledTimes(5);
  });

  it("traduit la saturation du hachage à l'inscription", async () => {
    state.headers.mockResolvedValueOnce(new Headers({ "x-real-ip": "register-queue-ip" }));
    state.hash.mockRejectedValueOnce(new ScryptQueueFullError());
    expect((await register({}, form())).error).toBe("tooManyAttempts");
    expect(state.create).not.toHaveBeenCalled();
  });

  it("traduit aussi la saturation de la connexion après création du compte", async () => {
    state.headers.mockResolvedValueOnce(new Headers({ "x-real-ip": "register-login-ip" }));
    state.signIn.mockRejectedValueOnce(rateLimitedError());
    expect((await register({}, form())).error).toBe("tooManyAttempts");
    expect(state.create).toHaveBeenCalledOnce();
  });
});
