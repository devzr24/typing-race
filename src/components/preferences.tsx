"use client";

import { Languages, Moon, Sun, SunMoon } from "lucide-react";
import { useState, useTransition } from "react";
import { setLocaleAction, setThemeAction } from "@/i18n/actions";
import { useI18n } from "@/i18n/client";
import { LOCALES, type Theme } from "@/i18n/config";

const LANGUAGE_NAMES = { fr: "FR", en: "EN" } as const;
const LANGUAGE_FULL_NAMES = { fr: "Français", en: "English" } as const;
const ICON_SIZE = 18;

function submit(action: (formData: FormData) => Promise<void>, name: string, value: string) {
  const formData = new FormData();
  formData.set(name, value);
  return action(formData);
}

export function LanguageSelect() {
  const { locale, m } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <label className="icon-frame" title={m.header.language}>
      <Languages size={ICON_SIZE} aria-hidden="true" />
      <span className="sr-only">{m.header.language}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const value = event.target.value;
          startTransition(() => submit(setLocaleAction, "locale", value));
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l} aria-label={LANGUAGE_FULL_NAMES[l]}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

const THEME_ICONS = { system: SunMoon, light: Sun, dark: Moon } as const;

export function ThemeSelect({ theme }: { theme: Theme | null }) {
  const { m } = useI18n();
  const [value, setValue] = useState<keyof typeof THEME_ICONS>(theme ?? "system");
  const [, startTransition] = useTransition();
  const Icon = THEME_ICONS[value];
  return (
    <label className="icon-frame" title={m.header.theme}>
      <Icon size={ICON_SIZE} aria-hidden="true" />
      <span className="sr-only">{m.header.theme}</span>
      <select
        value={value}
        onChange={(event) => {
          const next = event.target.value as keyof typeof THEME_ICONS;
          setValue(next);
          // Effet immédiat sur la page ; le cookie mémorise le choix pour le prochain chargement.
          const root = document.documentElement;
          root.classList.remove("light", "dark");
          if (next !== "system") root.classList.add(next);
          startTransition(() => submit(setThemeAction, "theme", next));
        }}
      >
        <option value="system">{m.header.themeSystem}</option>
        <option value="light">{m.header.themeLight}</option>
        <option value="dark">{m.header.themeDark}</option>
      </select>
    </label>
  );
}
