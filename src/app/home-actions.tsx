"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormError, FormField, heroButtonClass, inputClass, primaryButtonClass } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { errorText } from "@/i18n/format";
import { createRoomAction, joinRoomAction, type RoomFormState } from "@/lib/rooms/actions";
import { ROOM_CODE_LENGTH } from "@/lib/rooms/code";

const initialState: RoomFormState = {};

function LoginHint({ state }: { state: RoomFormState }) {
  const { m } = useI18n();
  if (state.error !== "loginRequired") return null;
  return (
    <Link href="/login" className="text-sm underline">
      {m.home.goToLogin}
    </Link>
  );
}

export function CreateRoomForm() {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(createRoomAction, initialState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError message={state.error && errorText(m, state.error)} />
      <LoginHint state={state} />
      <button type="submit" className={heroButtonClass} disabled={pending}>
        {pending ? m.home.creating : m.home.createRoom}
      </button>
    </form>
  );
}

export function JoinRoomForm() {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(joinRoomAction, initialState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error && errorText(m, state.error)} />
      <LoginHint state={state} />
      <FormField
        id="code"
        label={m.home.joinLabel}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={ROOM_CODE_LENGTH + 2}
        placeholder={m.home.joinPlaceholder}
        className={`${inputClass} font-mono uppercase tracking-widest`}
        defaultValue={state.values?.code}
      />
      <button type="submit" className={primaryButtonClass} disabled={pending}>
        {pending ? m.home.joining : m.home.join}
      </button>
    </form>
  );
}
