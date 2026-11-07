"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, PREFERENCE_COOKIE_MAX_AGE, THEME_COOKIE } from "./config";
import { localeSchema, themeSchema } from "./schemas";

const cookieOptions = { path: "/", maxAge: PREFERENCE_COOKIE_MAX_AGE, sameSite: "lax" } as const;

/** Mémorise la langue ; la page est ensuite rendue à nouveau dans cette langue. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = localeSchema.safeParse(formData.get("locale"));
  if (locale.success) (await cookies()).set(LOCALE_COOKIE, locale.data, cookieOptions);
}

/** Mémorise le thème ; « system » efface le choix pour suivre de nouveau le système. */
export async function setThemeAction(formData: FormData): Promise<void> {
  const theme = themeSchema.safeParse(formData.get("theme"));
  if (!theme.success) return;
  const store = await cookies();
  if (theme.data !== "system") store.set(THEME_COOKIE, theme.data, cookieOptions);
  else store.delete(THEME_COOKIE);
}
