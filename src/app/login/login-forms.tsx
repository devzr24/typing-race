"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { buttonClass, FormError, FormField } from "@/components/form-field";
import { continueAsGuest, loginWithPassword, type FormState } from "@/lib/auth/actions";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/auth/limits";

const initialState: FormState = {};

export function PasswordLoginForm() {
  const [state, action, pending] = useActionState(loginWithPassword, initialState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error} />
      <FormField
        id="username"
        label="Nom d'utilisateur"
        autoComplete="username"
        required
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username}
      />
      <FormField
        id="password"
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}

export function GuestForm() {
  const [state, action, pending] = useActionState(continueAsGuest, initialState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error} />
      <FormField
        id="pseudo"
        label="Pseudo temporaire (facultatif)"
        autoComplete="off"
        maxLength={USERNAME_MAX_LENGTH}
        hint={`${USERNAME_MIN_LENGTH} à ${USERNAME_MAX_LENGTH} caractères. Laisse vide pour un pseudo au hasard.`}
        defaultValue={state.values?.pseudo}
        error={state.fieldErrors?.pseudo}
      />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Un instant…" : "Continuer en invité"}
      </button>
    </form>
  );
}

// Erreurs renvoyées par Auth.js dans l'URL après un échec GitHub/Discord.
const OAUTH_ERRORS: Record<string, string> = {
  AccessDenied: "Connexion refusée.",
  Configuration: "La connexion est mal configurée sur le serveur. Réessaie plus tard.",
};

export function OAuthErrorMessage() {
  const code = useSearchParams().get("error");
  if (!code || code === "CredentialsSignin") return null;
  return <FormError message={OAUTH_ERRORS[code] ?? "La connexion a échoué. Réessaie."} />;
}
