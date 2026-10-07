import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRoomStore } from "./memory-store";
import { createRoom, joinRoom, leaveRoom, toPublicRoom } from "./service";
import type { Identity } from "./types";

const alice: Identity = { key: "u-alice", displayName: "alice", image: null, isGuest: false };
const bob: Identity = { key: "u-bob", displayName: "bob", image: "https://x/b.png", isGuest: false };
const guest: Identity = { key: "guest-1", displayName: "invite-1234", image: null, isGuest: true };

let store: MemoryRoomStore;
let clock: number;

beforeEach(() => {
  store = new MemoryRoomStore();
  clock = 0;
  // Chaque arrivée a lieu une seconde après la précédente.
  store.now = () => new Date(1_000 * ++clock);
});

async function names(code: string) {
  const room = await store.findRoom(code);
  return room ? toPublicRoom(room).participants.map((p) => `${p.displayName}${p.isHost ? "*" : ""}`) : null;
}

describe("createRoom", () => {
  it("crée une salle en attente dont le créateur est l'hôte", async () => {
    const code = await createRoom(store, alice);
    const room = await store.findRoom(code);
    expect(room?.status).toBe("EN_ATTENTE");
    expect(await names(code)).toEqual(["alice*"]);
  });

  it("un invité peut aussi créer une salle", async () => {
    const code = await createRoom(store, guest);
    expect(await names(code)).toEqual(["invite-1234*"]);
  });
});

describe("joinRoom", () => {
  it("ajoute le participant dans l'ordre d'arrivée", async () => {
    const code = await createRoom(store, alice);
    expect(await joinRoom(store, code, bob)).toEqual({ ok: true, code });
    expect(await joinRoom(store, code, guest)).toEqual({ ok: true, code });
    expect(await names(code)).toEqual(["alice*", "bob", "invite-1234"]);
  });

  it("accepte un code tapé en minuscules avec un tiret", async () => {
    const code = await createRoom(store, alice);
    const typed = `${code.slice(0, 3)}-${code.slice(3)}`.toLowerCase();
    expect(await joinRoom(store, typed, bob)).toEqual({ ok: true, code });
  });

  it("rejoindre une seconde fois garde la place (rechargement de page)", async () => {
    const code = await createRoom(store, alice);
    await joinRoom(store, code, bob);
    await joinRoom(store, code, guest);
    await joinRoom(store, code, bob);
    expect(await names(code)).toEqual(["alice*", "bob", "invite-1234"]);
  });

  it("refuse un code mal formé", async () => {
    const result = await joinRoom(store, "AB0", bob);
    expect(result).toEqual({ ok: false, error: "roomCodeInvalid" });
  });

  it("refuse une salle inexistante", async () => {
    const result = await joinRoom(store, "ABCDEF", bob);
    expect(result).toEqual({ ok: false, error: "roomNotFound" });
  });

  it("refuse une salle qui n'est plus en attente", async () => {
    const code = await createRoom(store, alice);
    store.rooms.get(code)!.status = "EN_COURSE";
    const result = await joinRoom(store, code, bob);
    expect(result).toEqual({ ok: false, error: "roomNotWaiting" });
  });
});

describe("leaveRoom", () => {
  it("retire un participant qui n'est pas l'hôte", async () => {
    const code = await createRoom(store, alice);
    await joinRoom(store, code, bob);
    expect(await leaveRoom(store, code, bob.key)).toBe("left");
    expect(await names(code)).toEqual(["alice*"]);
  });

  it("transfère l'hôte au participant arrivé le plus tôt", async () => {
    const code = await createRoom(store, alice);
    await joinRoom(store, code, bob);
    await joinRoom(store, code, guest);
    expect(await leaveRoom(store, code, alice.key)).toBe("left");
    expect(await names(code)).toEqual(["bob*", "invite-1234"]);
  });

  it("le transfert suit l'ordre d'arrivée, pas l'ordre d'insertion", async () => {
    const code = await createRoom(store, alice);
    await joinRoom(store, code, guest);
    await joinRoom(store, code, bob);
    // Bob est arrivé après l'invité : c'est l'invité qui devient hôte.
    await leaveRoom(store, code, alice.key);
    expect(await names(code)).toEqual(["invite-1234*", "bob"]);
  });

  it("supprime la salle quand le dernier participant part", async () => {
    const code = await createRoom(store, alice);
    expect(await leaveRoom(store, code, alice.key)).toBe("room-closed");
    expect(await store.findRoom(code)).toBeNull();
    expect((await joinRoom(store, code, bob)).ok).toBe(false);
  });

  it("ne fait rien si la personne n'est pas dans la salle", async () => {
    const code = await createRoom(store, alice);
    expect(await leaveRoom(store, code, bob.key)).toBe("not-in-room");
    expect(await leaveRoom(store, "ZZZZZZ", bob.key)).toBe("not-in-room");
    expect(await names(code)).toEqual(["alice*"]);
  });
});

describe("toPublicRoom", () => {
  it("n'expose pas les identifiants de session", async () => {
    const code = await createRoom(store, alice);
    const json = JSON.stringify(toPublicRoom((await store.findRoom(code))!));
    expect(json).not.toContain(alice.key);
  });
});
