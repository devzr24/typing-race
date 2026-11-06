"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ErrorCode } from "@/i18n/messages";
import { publishRoom } from "@/server/realtime";
import { normalizeRoomCode } from "./code";
import { identityFromSession } from "./identity";
import { roomStore } from "./prisma-store";
import { createRoom, joinRoom, leaveRoom, parseHostRole, validateRoomCreator } from "./service";

export type RoomFormState = {
  error?: ErrorCode;
  values?: { code?: string };
};

export async function createRoomAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const identity = identityFromSession(await auth());
  if (!identity) return { error: "guestCannotCreateRoom" };
  const error = validateRoomCreator(identity);
  if (error) return { error };
  const role = parseHostRole(formData.get("role"));
  if (!role) return { error: "hostRoleInvalid" };
  const code = await createRoom(roomStore, identity, role === "spectator");
  redirect(`/room/${code}`);
}

export async function joinRoomAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const rawCode = String(formData.get("code") ?? "");
  const values = { code: rawCode };
  const identity = identityFromSession(await auth());
  if (!identity) return { error: "loginRequired", values };

  const result = await joinRoom(roomStore, rawCode, identity);
  if (!result.ok) return { error: result.error, values };
  await publishRoom(result.code);
  redirect(`/room/${result.code}`);
}

export async function leaveRoomAction(formData: FormData): Promise<void> {
  const identity = identityFromSession(await auth());
  const code = normalizeRoomCode(String(formData.get("code") ?? ""));
  if (identity && code) {
    if ((await leaveRoom(roomStore, code, identity.key)) !== "not-in-room") await publishRoom(code);
  }
  redirect("/");
}
