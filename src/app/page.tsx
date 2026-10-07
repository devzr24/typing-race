import { CreateRoomForm, JoinRoomForm } from "./home-actions";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Typing Race</h1>
        <p>Courses de dactylographie multijoueurs en temps réel.</p>
      </div>
      <CreateRoomForm />
      <JoinRoomForm />
    </main>
  );
}
