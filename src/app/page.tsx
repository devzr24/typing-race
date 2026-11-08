import { auth } from "@/auth";
import Link from "next/link";
import { TypedTagline } from "@/components/effects";
import { getMessages } from "@/i18n/server";
import { CreateRoomForm, JoinRoomForm, QuickRaceForm } from "./home-actions";

export default async function Home({ searchParams }: PageProps<"/">) {
  const m = await getMessages();
  const session = await auth();
  const { notice } = await searchParams;
  return (
    <main id="contenu" tabIndex={-1} className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{m.app.name}</h1>
        <TypedTagline text={m.app.tagline} />
      </div>
      {notice === "roomKicked" || notice === "noLongerInRoom" ? <p role="alert" className="text-alert">{m.errors[notice]}</p> : null}
      <Link href="/salles" className="underline">{m.lobby.title}</Link>
      <QuickRaceForm canCreate={session?.user?.isGuest === false} />
      <CreateRoomForm canCreate={session?.user?.isGuest === false} />
      <JoinRoomForm />
    </main>
  );
}
