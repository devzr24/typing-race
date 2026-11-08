import { z } from "zod";
import { normalizeRoomCode, validateRoomCode } from "./code";
import { MAX_CHARACTERS_PER_MESSAGE } from "@/lib/race/metrics";

export const hostRoleSchema = z.enum(["participant", "spectator"]);
export const roomCodeSchema = z.string({ error: "roomCodeInvalid" }).transform(normalizeRoomCode)
  .superRefine((value, ctx) => {
    const error = validateRoomCode(value);
    if (error) ctx.addIssue({ code: "custom", message: error });
  });
/** Segment d'URL `/room/[code]` : décodage sans exception (`%E0%A4%A` → code invalide), puis règles du code. */
export const roomPathCodeSchema = z.string()
  .transform((raw, ctx) => {
    try {
      return decodeURIComponent(raw);
    } catch {
      ctx.addIssue({ code: "custom", message: "roomCodeInvalid" });
      return z.NEVER;
    }
  })
  .pipe(roomCodeSchema);
export const roomWatchSchema = z.object({ code: roomCodeSchema });
export const raceInputSchema = z.object({
  code: roomCodeSchema, seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  keys: z.string().min(1).max(MAX_CHARACTERS_PER_MESSAGE),
}).strict();
export const raceAbandonSchema = roomWatchSchema.strict();
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const roomAccessSchema = z.object({
  visibility: z.enum(["PUBLIQUE", "SUR_CODE", "PRIVEE"]),
  capacity: z.number().int().min(2).max(30),
}).strict();

// Caractères à taper : pas de caractère de contrôle (Postgres refuse l'octet nul).
const typedChars = z.string().max(40).regex(/^[^\u0000-\u001f\u007f]*$/);

export const raceConfigSchema = z.object({
  timeLimitSec: z.number().int().min(30).max(600).nullable(),
  textLanguage: z.enum(["FR", "EN"]),
  textType: z.enum(["COHERENT", "ALEATOIRE"]),
  wordCount: z.number().int().min(10).max(200),
  complexity: z.enum(["FACILE", "MOYEN", "DIFFICILE"]),
  punctuation: z.boolean(), numbers: z.boolean(), capitals: z.boolean(), accents: z.boolean(),
  includeChars: typedChars, excludeChars: typedChars,
  errorMode: z.enum(["CORRECTION", "LIBRE"]), bonusesEnabled: z.boolean(),
}).strict();

export const hostCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("configure"), config: raceConfigSchema }).strict(),
  z.object({ type: z.literal("configureAccess"), access: roomAccessSchema }).strict(),
  z.object({ type: z.literal("createInvites"), count: z.number().int().min(1).max(30) }).strict(),
  z.object({ type: z.literal("listInvites") }).strict(),
  z.object({ type: z.literal("kick"), id: z.string().min(1).max(100) }).strict(),
  z.object({ type: z.literal("addBot"), level: z.enum(["NOOB", "BEGINNER", "INTERMEDIATE", "EXPERT", "IMPOSSIBLE"]) }).strict(),
  z.object({ type: z.literal("removeBot"), id: z.string().min(1).max(100) }).strict(),
  z.object({ type: z.literal("start") }).strict(),
  z.object({ type: z.literal("reset") }).strict(),
  z.object({ type: z.literal("close") }).strict(),
]);
export type HostCommand = z.infer<typeof hostCommandSchema>;
export const roomCommandSchema = z.object({ code: roomCodeSchema, command: hostCommandSchema }).strict();
