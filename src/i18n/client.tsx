"use client";

import { createContext, use, type ReactNode } from "react";
import type { Locale } from "./config";
import { messages, type Messages } from "./messages";

const I18nContext = createContext<Locale | null>(null);

/** Donne la langue de la page aux composants client (les textes sont importés, pas transmis). */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext value={locale}>{children}</I18nContext>;
}

export function useI18n(): { locale: Locale; m: Messages } {
  const locale = use(I18nContext);
  if (!locale) throw new Error("useI18n doit être utilisé dans un I18nProvider.");
  return { locale, m: messages[locale] };
}
