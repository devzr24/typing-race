import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, isTheme, LOCALE_COOKIE, THEME_COOKIE, type Locale, type Theme } from "./config";
import { messages, type Messages } from "./messages";

/** Langue mémorisée dans le cookie, français par défaut. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getMessages(): Promise<Messages> {
  return messages[await getLocale()];
}

/** Thème choisi explicitement, ou null pour suivre le système. */
export async function getTheme(): Promise<Theme | null> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : null;
}
