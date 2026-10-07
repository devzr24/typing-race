import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { errorText } from "@/i18n/format";
import type { ErrorCode, Messages } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { normalizeRoomCode, validateRoomCode } from "@/lib/rooms/code";
import { roomStore } from "@/lib/rooms/prisma-store";
import { toPublicRoom } from "@/lib/rooms/service";
import { RoomView } from "./room-view";

export async function generateMetadata({ params }: PageProps<"/room/[code]">): Promise<Metadata> {
  const [m, { code }] = await Promise.all([getMessages(), params]);
  return { title: `${m.room.title.replace("{code}", normalizeRoomCode(code))} — ${m.app.name}` };
}

function Notice({ m, title, error }: { m: Messages; title: string; error: ErrorCode }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p role="alert">{errorText(m, error)}</p>
      <Link href="/" className="underline">
        {m.room.backHome}
      </Link>
    </>
  );
}

export default async function RoomPage({ params }: PageProps<"/room/[code]">) {
  const [m, { code: rawCode }, session] = await Promise.all([getMessages(), params, auth()]);
  const code = normalizeRoomCode(decodeURIComponent(rawCode));

  let content;
  if (validateRoomCode(code)) {
    content = <Notice m={m} title={m.room.notFoundTitle} error="roomCodeInvalid" />;
  } else if (!session?.user) {
    content = <Notice m={m} title={m.room.loginRequiredTitle} error="loginRequiredForRoom" />;
  } else {
    const room = await roomStore.findRoom(code);
    const self = room?.participants.find((p) => p.key === session.user.id);
    if (!room) {
      content = <Notice m={m} title={m.room.notFoundTitle} error="roomNotFound" />;
    } else if (!self) {
      // Pas d'arrivée par simple lien : on rejoint une salle avec son code, depuis l'accueil.
      content = <Notice m={m} title={m.room.notJoinedTitle} error="notInRoom" />;
    } else {
      content = <RoomView initialRoom={toPublicRoom(room)} selfId={self.id} />;
    }
  }

  return <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">{content}</main>;
}
