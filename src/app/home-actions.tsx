"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass, FormError, FormField, heroButtonClass, inputClass, primaryButtonClass } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { errorText, format } from "@/i18n/format";
import { createRoomAction, joinInviteAction, joinRoomAction, quickJoinAction, type RoomFormState } from "@/lib/rooms/actions";
import { ROOM_CODE_LENGTH } from "@/lib/rooms/code";

const initialState: RoomFormState = {};

function LeaveAndJoin({ state, pending }: { state: RoomFormState; pending: boolean }) {
  const { m } = useI18n();
  return state.currentCode ? <button type="submit" name="leaveCurrent" value="true" className={buttonClass} disabled={pending}>
    {format(m.home.leaveAndJoin, { code: state.currentCode })}
  </button> : null;
}

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
      <LeaveAndJoin state={state} pending={pending} />
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

export function JoinRoomForm({ code, initialState: state = initialState }: { code?: string; initialState?: RoomFormState } = {}) {
  const { m } = useI18n();
  const [result, action, pending] = useActionState(joinRoomAction, state);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={result.error && errorText(m, result.error)} />
      <LoginHint state={result} />
      <LeaveAndJoin state={result} pending={pending} />
      <FormField
        id="code"
        label={m.home.joinLabel}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={ROOM_CODE_LENGTH + 2}
        placeholder={m.home.joinPlaceholder}
        className={`${inputClass} font-mono uppercase tracking-widest`}
        defaultValue={result.values?.code ?? code}
      />
      <label className="flex items-center gap-2"><input type="checkbox" name="spectator" value="true" />{m.room.joinSpectator}</label>
      <button type="submit" className={primaryButtonClass} disabled={pending}>
        {pending ? m.home.joining : m.home.join}
      </button>
    </form>
  );
}

export function QuickRaceForm({ canCreate }: { canCreate: boolean }) {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(quickJoinAction, initialState);
  const [createState, createAction, creating] = useActionState(createRoomAction, initialState);
  return <section className="flex flex-col gap-3">
    <form action={action} className="flex flex-col gap-3">
      <FormError message={state.error && errorText(m, state.error)} />
      <LoginHint state={state} />
      <LeaveAndJoin state={state} pending={pending} />
      <button className={primaryButtonClass} disabled={pending}>{m.lobby.quickRace}</button>
    </form>
    {state.error === "noPublicRoom" && canCreate ? <form action={createAction} className="flex flex-col gap-3">
      <input type="hidden" name="role" value="participant" />
      <FormError message={createState.error && errorText(m, createState.error)} />
      <LeaveAndJoin state={createState} pending={creating} />
      <button className={buttonClass} disabled={creating}>{m.lobby.createPublic}</button>
    </form> : null}
  </section>;
}

export function InviteJoinForm({ token, initialState: state }: { token: string; initialState: RoomFormState }) {
  const { m } = useI18n();
  const [result, action, pending] = useActionState(joinInviteAction, state);
  return <form action={action} className="flex flex-col gap-3">
    <input type="hidden" name="token" value={token} />
    <FormError message={result.error && errorText(m, result.error)} />
    <LoginHint state={result} />
    <LeaveAndJoin state={result} pending={pending} />
    <label className="flex items-center gap-2"><input type="checkbox" name="spectator" value="true" />{m.room.joinSpectator}</label>
    <button className={primaryButtonClass} disabled={pending}>{m.home.join}</button>
  </form>;
}
