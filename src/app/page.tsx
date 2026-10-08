import { TypedTagline } from "@/components/effects";
import { getMessages } from "@/i18n/server";
import { CreateRoomForm, JoinRoomForm } from "./home-actions";

export default async function Home() {
  const m = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{m.app.name}</h1>
        <TypedTagline text={m.app.tagline} />
      </div>
      <CreateRoomForm />
      <JoinRoomForm />
    </main>
  );
}
