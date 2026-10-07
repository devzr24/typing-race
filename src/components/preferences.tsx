"use client";

import { useTransition } from "react";
import { selectClass } from "@/components/form-field";
import { setLocaleAction, setThemeAction } from "@/i18n/actions";
import { useI18n } from "@/i18n/client";
import { LOCALES, type Theme } from "@/i18n/config";

const LANGUAGE_NAMES = { fr: "Français", en: "English" } as const;

function submit(action: (formData: FormData) => Promise<void>, name: string, value: string) {
  const formData = new FormData();
  formData.set(name, value);
  return action(formData);
}

export function LanguageSelect() {
  const { locale, m } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{m.header.language}</span>
      <select
        className={selectClass}
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const value = event.target.value;
          startTransition(() => submit(setLocaleAction, "locale", value));
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ThemeSelect({ theme }: { theme: Theme | null }) {
  const { m } = useI18n();
  const [, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{m.header.theme}</span>
      <select
        className={selectClass}
        defaultValue={theme ?? "system"}
        onChange={(event) => {
          const value = event.target.value;
          // Effet immédiat sur la page ; le cookie mémorise le choix pour le prochain chargement.
          const root = document.documentElement;
          root.classList.remove("light", "dark");
          if (value === "light" || value === "dark") root.classList.add(value);
          startTransition(() => submit(setThemeAction, "theme", value));
        }}
      >
        <option value="system">{m.header.themeSystem}</option>
        <option value="light">{m.header.themeLight}</option>
        <option value="dark">{m.header.themeDark}</option>
      </select>
    </label>
  );
}
