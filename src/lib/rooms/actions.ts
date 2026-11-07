"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import type { ErrorCode } from "@/i18n/messages";
import { connectedRoomKeys, publishDeparture, publishRoom } from "@/server/realtime";
import { clientIp } from "@/lib/auth/rate-limit";
import { consumeCodeAttempt } from "./code-rate-limit";
import { MembershipConflictError } from "./store";
import { hostRoleSchema, inviteTokenSchema, roomCodeSchema } from "./schemas";
import { identityFromSession } from "./identity";
import { roomStore } from "./prisma-store";
import { createRoom, joinInvite, joinRoom, leaveCurrentRoom, leaveRoom, quickJoin, validateRoomCreator, type JoinOptions } from "./service";

export type RoomFormState = {
  error?: ErrorCode;
  values?: { code?: string };
  currentCode?: string;
};

function joinOptions(formData: FormData): JoinOptions {
  return { isSpectator: formData.get("spectator") === "true", leaveCurrent: formData.get("leaveCurrent") === "true",
    connectedKeys: connectedRoomKeys, onLeave: publishDeparture };
}

export async function createRoomAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const identity = identityFromSession(await auth());
  if (!identity) return { error: "guestCannotCreateRoom" };
  const error = validateRoomCreator(identity);
  if (error) return { error };
  const role = hostRoleSchema.safeParse(formData.get("role"));
  if (!role.success) return { error: "hostRoleInvalid" };
  const conflict = await leaveCurrentRoom(roomStore, identity, joinOptions(formData));
  if (conflict && !conflict.ok) return conflict;
  let code: string;
  try {
    code = await createRoom(roomStore, identity, role.data === "spectator");
  } catch (error) {
    if (!(error instanceof MembershipConflictError)) throw error;
    return { error: "alreadyInRoom", currentCode: error.currentCode ?? undefined };
  }
  await publishRoom(code);
  redirect(`/room/${code}`);
}

export async function joinRoomAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const input = formData.get("code");
  const rawCode = typeof input === "string" ? input : "";
  const values = { code: rawCode };
  if (!consumeCodeAttempt(clientIp(await headers()))) return { error: "tooManyAttempts", values };
  const identity = identityFromSession(await auth());
  if (!identity) return { error: "loginRequired", values };

  const parsed = roomCodeSchema.safeParse(rawCode);
  if (!parsed.success) return { error: parsed.error.issues[0].message as ErrorCode, values };
  const result = await joinRoom(roomStore, parsed.data, identity, joinOptions(formData));
  if (!result.ok) return { error: result.error, currentCode: result.currentCode, values };
  await publishRoom(result.code);
  redirect(`/room/${result.code}`);
}

export async function quickJoinAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const identity = identityFromSession(await auth());
  if (!identity) return { error: "loginRequired" };
  const result = await quickJoin(roomStore, identity, joinOptions(formData));
  if (!result.ok) return result;
  await publishRoom(result.code);
  redirect(`/room/${result.code}`);
}

export async function joinInviteAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const identity = identityFromSession(await auth());
  if (!identity) return { error: "loginRequired" };
  const token = inviteTokenSchema.safeParse(formData.get("token"));
  if (!token.success) return { error: "inviteInvalid" };
  const result = await joinInvite(roomStore, token.data, identity, clientIp(await headers()), joinOptions(formData));
  if (!result.ok) return result;
  await publishRoom(result.code);
  redirect(`/room/${result.code}`);
}

export async function leaveRoomAction(formData: FormData): Promise<void> {
  const identity = identityFromSession(await auth());
  const parsed = roomCodeSchema.safeParse(formData.get("code"));
  if (identity && parsed.success) {
    const code = parsed.data;
    if ((await leaveRoom(roomStore, code, identity.key, await connectedRoomKeys(code))) !== "not-in-room") await publishDeparture(code, identity.key);
  }
  redirect("/");
}
