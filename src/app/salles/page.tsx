import { auth } from "@/auth";
import { getMessages } from "@/i18n/server";
import { roomStore } from "@/lib/rooms/prisma-store";
import { listLobbyRooms } from "@/lib/rooms/service";
import { QuickRaceForm } from "@/app/home-actions";
import { LobbyView } from "./lobby-view";

export default async function RoomsPage() {
  const [m, session, rooms] = await Promise.all([getMessages(), auth(), listLobbyRooms(roomStore)]);
  return <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">{m.lobby.title}</h1>
    <QuickRaceForm canCreate={session?.user?.isGuest === false} />
    <LobbyView initialRooms={rooms} />
  </main>;
}
