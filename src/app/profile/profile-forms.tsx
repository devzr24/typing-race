"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { FormError, FormField, primaryButtonClass } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { errorText } from "@/i18n/format";
import { GUEST_PSEUDO_MAX_LENGTH, GUEST_PSEUDO_MIN_LENGTH } from "@/lib/auth/limits";
import { updateDisplayName, uploadAvatar, type ProfileFormState } from "@/lib/profile/actions";

const initialState: ProfileFormState = {};

export function ProfileForms({ name }: { name: string }) {
  const { m } = useI18n();
  const [nameState, nameAction, namePending] = useActionState(updateDisplayName, initialState);
  const [avatarState, avatarAction, avatarPending] = useActionState(async (prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> => {
    const file = formData.get("avatar");
    if (file instanceof File && file.size > 2 * 1024 * 1024) return { error: "avatarTooLarge" };
    return uploadAvatar(prev, formData);
  }, initialState);
  // Nouvelle requête après l'enregistrement : elle porte le JWT réécrit, l'en-tête l'affiche.
  const router = useRouter();
  useEffect(() => {
    if (nameState.saved || avatarState.saved) router.refresh();
  }, [nameState, avatarState, router]);
  return <div className="grid gap-6 sm:grid-cols-2">
    <form action={nameAction} className="flex flex-col gap-3" noValidate>
      <FormError message={nameState.error && errorText(m, nameState.error)} />
      <FormField id="name" label={m.profile.name} hint={m.profile.nameHint} defaultValue={name}
        minLength={GUEST_PSEUDO_MIN_LENGTH} maxLength={GUEST_PSEUDO_MAX_LENGTH} required autoComplete="nickname" />
      <button type="submit" className={primaryButtonClass} disabled={namePending}>
        {namePending ? m.profile.saving : m.profile.saveName}
      </button>
      {nameState.saved ? <p role="status">{m.profile.saved}</p> : null}
    </form>
    <form action={avatarAction} className="flex flex-col gap-3" noValidate>
      <FormError message={avatarState.error && errorText(m, avatarState.error)} />
      <FormField id="avatar" type="file" label={m.profile.avatar} hint={m.profile.avatarHint}
        accept="image/jpeg,image/png,image/webp" required />
      <button type="submit" className={primaryButtonClass} disabled={avatarPending}>
        {avatarPending ? m.profile.saving : m.profile.saveAvatar}
      </button>
      {avatarState.saved ? <p role="status">{m.profile.saved}</p> : null}
    </form>
  </div>;
}
