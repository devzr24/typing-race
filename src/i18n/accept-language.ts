import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  let locale = DEFAULT_LOCALE;
  let bestWeight = 0;

  for (const entry of header?.split(",") ?? []) {
    const match = entry.trim().match(
      /^([a-z]{1,8}(?:-[a-z0-9]{1,8})*)(?:\s*;\s*q\s*=\s*(0(?:\.\d*)?|1(?:\.0*)?))?$/i,
    );
    if (!match) continue;

    const primary = match[1].split("-")[0].toLowerCase();
    const supported = LOCALES.find((value) => value === primary);
    const weight = match[2] === undefined ? 1 : Number(match[2]);
    if (supported && weight > bestWeight) {
      locale = supported;
      bestWeight = weight;
    }
  }

  return locale;
}
