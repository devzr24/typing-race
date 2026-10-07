"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { buttonClass, FormError, FormField } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { errorText, format } from "@/i18n/format";
import type { ErrorCode } from "@/i18n/messages";
import { continueAsGuest, loginWithPassword, type FormState } from "@/lib/auth/actions";
import { USERNAME_MAX_LENGTH } from "@/lib/auth/limits";

const initialState: FormState = {};

export function PasswordLoginForm() {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(loginWithPassword, initialState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error && errorText(m, state.error)} />
      <FormField
        id="username"
        label={m.login.username}
        autoComplete="username"
        required
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username && errorText(m, state.fieldErrors.username)}
      />
      <FormField
        id="password"
        label={m.login.password}
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password && errorText(m, state.fieldErrors.password)}
      />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? m.login.submitting : m.login.submit}
      </button>
    </form>
  );
}

export function GuestForm() {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(continueAsGuest, initialState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error && errorText(m, state.error)} />
      <FormField
        id="pseudo"
        label={m.login.pseudo}
        autoComplete="off"
        maxLength={USERNAME_MAX_LENGTH}
        hint={format(m.login.pseudoHint)}
        defaultValue={state.values?.pseudo}
        error={state.fieldErrors?.pseudo && errorText(m, state.fieldErrors.pseudo)}
      />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? m.login.guestSubmitting : m.login.guestSubmit}
      </button>
    </form>
  );
}

// Erreurs renvoyées par Auth.js dans l'URL après un échec GitHub/Discord.
const OAUTH_ERRORS: Record<string, ErrorCode> = {
  AccessDenied: "oauthAccessDenied",
  Configuration: "oauthConfiguration",
};

export function OAuthErrorMessage() {
  const { m } = useI18n();
  const code = useSearchParams().get("error");
  if (!code || code === "CredentialsSignin") return null;
  return <FormError message={errorText(m, OAUTH_ERRORS[code] ?? "oauthFailed")} />;
}
