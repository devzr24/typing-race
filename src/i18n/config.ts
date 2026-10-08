// Langues et thèmes : valeurs mémorisées dans des cookies (ADR 0009).

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "lang";

/** Thème choisi explicitement ; sans cookie, on suit le thème du système. */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";

/** « off » si l'utilisateur a désactivé les effets (activés par défaut). */
export const EFFECTS_COOKIE = "fx";
/** « on » si l'utilisateur a activé le son (coupé par défaut). */
export const SOUND_COOKIE = "sound";

/** Un an : le choix est retenu d'une visite à l'autre. */
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}
