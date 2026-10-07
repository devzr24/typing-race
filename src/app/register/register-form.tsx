"use client";

import { useActionState } from "react";
import { buttonClass, FormError, FormField } from "@/components/form-field";
import { register, type FormState } from "@/lib/auth/actions";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/limits";

const initialState: FormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, initialState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error} />
      <FormField
        id="username"
        label="Nom d'utilisateur"
        autoComplete="username"
        required
        maxLength={USERNAME_MAX_LENGTH}
        hint={`${USERNAME_MIN_LENGTH} à ${USERNAME_MAX_LENGTH} caractères : lettres a-z, chiffres, « _ » et « - ».`}
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username}
      />
      <FormField
        id="password"
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX_LENGTH}
        hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`}
        error={state.fieldErrors?.password}
      />
      <FormField
        id="confirm"
        label="Confirmer le mot de passe"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm}
      />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Création…" : "Créer mon compte"}
      </button>
    </form>
  );
}
