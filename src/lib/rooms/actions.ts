"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ErrorCode } from "@/i18n/messages";
import { publishRoom } from "@/server/realtime";
import { hostRoleSchema, roomCodeSchema } from "./schemas";
import { identityFromSession } from "./identity";
import { roomStore } from "./prisma-store";
import { createRoom, joinRoom, leaveRoom, validateRoomCreator } from "./service";

export type RoomFormState = {
  error?: ErrorCode;
  values?: { code?: string };
};

export async function createRoomAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const identity = identityFromSession(await auth());
  if (!identity) return { error: "guestCannotCreateRoom" };
  const error = validateRoomCreator(identity);
  if (error) return { error };
  const role = hostRoleSchema.safeParse(formData.get("role"));
  if (!role.success) return { error: "hostRoleInvalid" };
  const code = await createRoom(roomStore, identity, role.data === "spectator");
  redirect(`/room/${code}`);
}

export async function joinRoomAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const input = formData.get("code");
  const rawCode = typeof input === "string" ? input : "";
  const values = { code: rawCode };
  const identity = identityFromSession(await auth());
  if (!identity) return { error: "loginRequired", values };

  const parsed = roomCodeSchema.safeParse(rawCode);
  if (!parsed.success) return { error: parsed.error.issues[0].message as ErrorCode, values };
  const result = await joinRoom(roomStore, parsed.data, identity);
  if (!result.ok) return { error: result.error, values };
  await publishRoom(result.code);
  redirect(`/room/${result.code}`);
}

export async function leaveRoomAction(formData: FormData): Promise<void> {
  const identity = identityFromSession(await auth());
  const parsed = roomCodeSchema.safeParse(formData.get("code"));
  if (identity && parsed.success) {
    const code = parsed.data;
    if ((await leaveRoom(roomStore, code, identity.key)) !== "not-in-room") await publishRoom(code);
  }
  redirect("/");
}
