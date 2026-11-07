import { cookies, headers } from "next/headers";
import { localeFromAcceptLanguage } from "./accept-language";
import {
  EFFECTS_COOKIE,
  isLocale,
  isTheme,
  LOCALE_COOKIE,
  SOUND_COOKIE,
  THEME_COOKIE,
  type Locale,
  type Theme,
} from "./config";
import { messages, type Messages } from "./messages";

/** Langue du cookie valide, sinon du navigateur, puis langue par défaut. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : localeFromAcceptLanguage((await headers()).get("accept-language"));
}

export async function getMessages(): Promise<Messages> {
  return messages[await getLocale()];
}

/** Thème choisi explicitement, ou null pour suivre le système. */
export async function getTheme(): Promise<Theme | null> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : null;
}

/** Préférences Son (coupé par défaut) et Effets (activés par défaut). */
export async function getFeedbackPreferences(): Promise<{ sound: boolean; effects: boolean }> {
  const store = await cookies();
  return {
    sound: store.get(SOUND_COOKIE)?.value === "on",
    effects: store.get(EFFECTS_COOKIE)?.value !== "off",
  };
}
