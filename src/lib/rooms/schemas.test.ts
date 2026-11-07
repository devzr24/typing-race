import { describe, expect, it } from "vitest";
import { hostRoleSchema, roomCodeSchema, roomCommandSchema, roomPathCodeSchema, roomWatchSchema } from "./schemas";

describe("schémas des salles", () => {
  it.each([
    null, {}, { code: "ABCDEF" }, { code: "invalid", command: { type: "start" } },
    { code: "ABCDEF", command: { type: "addBot", level: "invalid" } },
    { code: "ABCDEF", command: { type: "removeBot", id: "" } },
    { code: "ABCDEF", command: { type: "start", hostKey: "forged" } },
    { code: "ABCDEF", command: { type: "start" }, identity: { key: "forged" } },
  ])("refuse une commande invalide ou une identité fournie par le client : %j", (payload) => {
    expect(roomCommandSchema.safeParse(payload).success).toBe(false);
  });

  it.each([null, undefined, "ABCDEF", 42, [], {}, { code: "bad" }, { code: 123456 },
    { code: null }, { code: ["ABCDEF"] },
  ])("rejette room:watch invalide : %j", (payload) => {
    expect(roomWatchSchema.safeParse(payload).success).toBe(false);
  });

  it("normalise un code valide", () => {
    expect(roomWatchSchema.parse({ code: "abc-def" })).toEqual({ code: "ABCDEF" });
  });

  it("ignore les champs supplémentaires de room:watch", () => {
    expect(roomWatchSchema.parse({ code: "abc-def", extra: true })).toEqual({ code: "ABCDEF" });
  });

  it("conserve le code d'erreur pour un code absent", () => {
    const result = roomCodeSchema.safeParse("");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("roomCodeRequired");
  });

  it("décode le segment d'URL et refuse un encodage invalide sans exception", () => {
    expect(roomPathCodeSchema.parse("abc%2Ddef")).toBe("ABCDEF");
    expect(roomPathCodeSchema.safeParse("%E0%A4%A").success).toBe(false);
  });

  it("refuse un rôle inconnu", () => {
    expect(hostRoleSchema.safeParse("host").success).toBe(false);
    expect(hostRoleSchema.parse("participant")).toBe("participant");
    expect(hostRoleSchema.parse("spectator")).toBe("spectator");
  });
});
