import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authRateLimiter } from "@/lib/auth/rate-limit";
import { AVATAR_MAX_BYTES } from "./image";
import { updateDisplayName, uploadAvatar } from "./actions";

const state = vi.hoisted(() => ({
  auth: vi.fn(), updateSession: vi.fn(), updateUser: vi.fn(), findUser: vi.fn(), membership: vi.fn(), refresh: vi.fn(),
  upsertAvatar: vi.fn(), transaction: vi.fn(), publish: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: state.auth, unstable_update: state.updateSession }));
vi.mock("next/cache", () => ({ refresh: state.refresh }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  user: { update: state.updateUser, findFirst: state.findUser }, roomParticipant: { findUnique: state.membership }, $transaction: state.transaction,
} }));
vi.mock("@/server/realtime", () => ({ publishRoom: state.publish }));

beforeEach(() => {
  vi.resetAllMocks();
  state.auth.mockResolvedValue({ user: { id: "profile-user", isGuest: false } });
  state.membership.mockResolvedValue(null);
  state.findUser.mockResolvedValue(null);
  state.upsertAvatar.mockResolvedValue({ updatedAt: new Date(123456789) });
  state.transaction.mockImplementation((fn) => fn({
    userAvatar: { upsert: state.upsertAvatar }, user: { update: state.updateUser },
  }));
  authRateLimiter.reset("avatar:user:profile-user");
});

function nameForm(name: string) {
  const form = new FormData();
  form.set("name", name);
  return form;
}

describe("actions du profil", () => {
  it.each([null, { user: { id: "guest-1", isGuest: true } }])("refuse le profil hors compte inscrit", async (session) => {
    state.auth.mockResolvedValue(session);
    expect(await updateDisplayName({}, nameForm("alice"))).toEqual({ error: "profileAccountRequired" });
    expect(await uploadAvatar({}, new FormData())).toEqual({ error: "profileAccountRequired" });
    expect(state.updateUser).not.toHaveBeenCalled();
    expect(state.transaction).not.toHaveBeenCalled();
  });

  it.each(["", "ab", "a".repeat(21), "bad name", "_alice"])("refuse un pseudonyme invalide %j", async (name) => {
    expect((await updateDisplayName({}, nameForm(name))).error).toBeTruthy();
    expect(state.updateUser).not.toHaveBeenCalled();
  });

  it.each(["abc", "a".repeat(20)])("enregistre le pseudonyme, rafraîchit le JWT et la salle : %s", async (name) => {
    state.membership.mockResolvedValue({ room: { code: "ABC234" } });
    expect(await updateDisplayName({}, nameForm(` ${name.toUpperCase()} `))).toEqual({ saved: true });
    expect(state.updateUser).toHaveBeenCalledWith({
      where: { id: "profile-user" }, data: { name, roomEntries: { updateMany: { where: {}, data: { displayName: name } } } },
    });
    expect(state.updateSession).toHaveBeenCalledWith({});
    expect(state.publish).toHaveBeenCalledWith("ABC234");
  });

  it("refuse le username d’un autre compte sans tenir compte de la casse", async () => {
    state.findUser.mockResolvedValue({ id: "another-user" });
    expect(await updateDisplayName({}, nameForm(" Alice "))).toEqual({ error: "displayNameTaken" });
    expect(state.findUser).toHaveBeenCalledWith({
      where: { username: { equals: "alice", mode: "insensitive" }, id: { not: "profile-user" } },
      select: { id: true },
    });
    expect(state.updateUser).not.toHaveBeenCalled();
    expect(state.updateSession).not.toHaveBeenCalled();
  });

  it("refuse un fichier trop gros avant sa lecture complète", async () => {
    const form = new FormData();
    const file = new File([new Uint8Array(AVATAR_MAX_BYTES + 1)], "large.png");
    const read = vi.spyOn(file, "arrayBuffer");
    form.set("avatar", file);
    expect(await uploadAvatar({}, form)).toEqual({ error: "avatarTooLarge" });
    expect(read).not.toHaveBeenCalled();
    expect(state.transaction).not.toHaveBeenCalled();
  });

  it("stocke uniquement le WebP traité et une URL versionnée", async () => {
    const bytes = await sharp({ create: { width: 4, height: 3, channels: 3, background: "red" } }).png().toBuffer();
    const form = new FormData();
    form.set("avatar", new File([new Uint8Array(bytes)], "photo.txt", { type: "text/plain" }));
    expect(await uploadAvatar({}, form)).toEqual({ saved: true });
    const stored = state.upsertAvatar.mock.calls[0][0].create;
    expect(stored.mime).toBe("image/webp");
    expect(await sharp(stored.bytes).metadata()).toMatchObject({ width: 256, height: 256, format: "webp" });
    expect(state.updateUser.mock.calls[0][0].data.image).toBe("/api/avatars/profile-user?v=123456789");
    expect(state.updateSession).toHaveBeenCalledOnce();
  });

  it("limite les tentatives à dix par heure et par utilisateur", async () => {
    for (let i = 0; i < 10; i++) expect(await uploadAvatar({}, new FormData())).toEqual({ error: "avatarUnreadable" });
    expect(await uploadAvatar({}, new FormData())).toEqual({ error: "tooManyAttempts" });
    state.auth.mockResolvedValue({ user: { id: "another-user", isGuest: false } });
    expect(await uploadAvatar({}, new FormData())).toEqual({ error: "avatarUnreadable" });
  });
});
