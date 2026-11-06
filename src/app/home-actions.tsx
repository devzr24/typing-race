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
  if (state.error !== "loginRequired" && state.error !== "guestCannotCreateRoom") return null;
  return (
    <Link href="/login" className="text-sm underline">
      {m.home.goToLogin}
    </Link>
  );
}

export function CreateRoomForm({ canCreate }: { canCreate: boolean }) {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(createRoomAction, initialState);
  if (!canCreate) {
    return (
      <p className="text-sm text-mist">
        {m.home.accountRequired} <Link href="/login" className="underline">{m.home.goToLogin}</Link>
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError message={state.error && errorText(m, state.error)} />
      <LoginHint state={state} />
      <fieldset className="flex flex-col gap-2" disabled={pending}>
        <legend>{m.home.hostRole}</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="participant" defaultChecked />
          {m.home.participant}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="spectator" />
          {m.home.spectatorOnly}
        </label>
      </fieldset>
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
