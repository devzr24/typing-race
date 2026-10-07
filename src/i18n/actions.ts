"use server";

import { cookies } from "next/headers";
import { isLocale, isTheme, LOCALE_COOKIE, PREFERENCE_COOKIE_MAX_AGE, THEME_COOKIE } from "./config";

const cookieOptions = { path: "/", maxAge: PREFERENCE_COOKIE_MAX_AGE, sameSite: "lax" } as const;

/** Mémorise la langue ; la page est ensuite rendue à nouveau dans cette langue. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (isLocale(locale)) (await cookies()).set(LOCALE_COOKIE, locale, cookieOptions);
}

/** Mémorise le thème ; « system » efface le choix pour suivre de nouveau le système. */
export async function setThemeAction(formData: FormData): Promise<void> {
  const theme = formData.get("theme");
  const store = await cookies();
  if (isTheme(theme)) store.set(THEME_COOKIE, theme, cookieOptions);
  else store.delete(THEME_COOKIE);
}
