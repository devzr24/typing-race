"use client";

import { useActionState } from "react";
import { buttonClass, FormError, FormField } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { errorText, format } from "@/i18n/format";
import { register, type FormState } from "@/lib/auth/actions";
import { PASSWORD_MAX_LENGTH, USERNAME_MAX_LENGTH } from "@/lib/auth/limits";

const initialState: FormState = {};

export function RegisterForm() {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(register, initialState);
  const fieldError = (name: keyof NonNullable<FormState["fieldErrors"]>) => {
    const code = state.fieldErrors?.[name];
    return code && errorText(m, code);
  };
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error && errorText(m, state.error)} />
      <FormField
        id="username"
        label={m.register.username}
        autoComplete="username"
        required
        maxLength={USERNAME_MAX_LENGTH}
        hint={format(m.register.usernameHint)}
        defaultValue={state.values?.username}
        error={fieldError("username")}
      />
      <FormField
        id="password"
        label={m.register.password}
        type="password"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX_LENGTH}
        hint={format(m.register.passwordHint)}
        error={fieldError("password")}
      />
      <FormField
        id="confirm"
        label={m.register.confirm}
        type="password"
        autoComplete="new-password"
        required
        error={fieldError("confirm")}
      />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? m.register.submitting : m.register.submit}
      </button>
    </form>
  );
}
