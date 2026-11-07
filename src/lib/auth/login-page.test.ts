import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
import { fr } from "@/i18n/messages/fr";

const state = vi.hoisted(() => ({ auth: vi.fn(), redirect: vi.fn() }));

vi.mock("@/auth", () => ({ auth: state.auth }));
vi.mock("next/navigation", () => ({ redirect: state.redirect }));
vi.mock("@/i18n/server", () => ({ getMessages: async () => fr }));
vi.mock("./actions", () => ({ signInWithProvider: vi.fn() }));
vi.mock("@/app/login/login-forms", () => ({
  GuestForm: () => null,
  OAuthErrorMessage: () => null,
  PasswordLoginForm: () => null,
}));

beforeEach(() => {
  vi.resetAllMocks();
  state.auth.mockResolvedValue({ user: { id: "user-id" } });
  state.redirect.mockImplementation(() => { throw new Error("redirect"); });
});

describe("page de connexion", () => {
  it.each(["OAuthAccountNotLinked", ""])("laisse la page accessible avec error=%s", async (error) => {
    await expect(LoginPage({ searchParams: Promise.resolve({ error }) }))
      .resolves.toMatchObject({ type: "main" });
    expect(state.redirect).not.toHaveBeenCalled();
  });

  it("redirige la personne connectée sans erreur", async () => {
    await expect(LoginPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect");
    expect(state.redirect).toHaveBeenCalledWith("/");
  });

  it("affiche la page sans session ni erreur", async () => {
    state.auth.mockResolvedValue(null);
    await expect(LoginPage({ searchParams: Promise.resolve({}) }))
      .resolves.toMatchObject({ type: "main" });
    expect(state.redirect).not.toHaveBeenCalled();
  });
});
