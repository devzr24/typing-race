"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass, FormError, FormField } from "@/components/form-field";
import { createRoomAction, joinRoomAction, type RoomFormState } from "@/lib/rooms/actions";
import { ROOM_CODE_LENGTH } from "@/lib/rooms/code";

const initialState: RoomFormState = {};

function LoginHint({ state }: { state: RoomFormState }) {
  if (!state.needsLogin) return null;
  return (
    <Link href="/login" className="text-sm underline">
      Aller à la page de connexion
    </Link>
  );
}

export function CreateRoomForm() {
  const [state, action, pending] = useActionState(createRoomAction, initialState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError message={state.error} />
      <LoginHint state={state} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Création…" : "Créer une salle"}
      </button>
    </form>
  );
}

export function JoinRoomForm() {
  const [state, action, pending] = useActionState(joinRoomAction, initialState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error} />
      <LoginHint state={state} />
      <FormField
        id="code"
        label="Rejoindre avec un code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={ROOM_CODE_LENGTH + 2}
        placeholder="Ex. : K7MPQ2"
        className="rounded border border-zinc-300 bg-transparent px-3 py-2 font-mono uppercase tracking-widest aria-invalid:border-red-600 dark:border-zinc-700"
        defaultValue={state.values?.code}
      />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Connexion à la salle…" : "Rejoindre"}
      </button>
    </form>
  );
}
