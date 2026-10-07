import { describe, expect, it } from "vitest";
import { LOCALES } from "./config";
import { errorText, format } from "./format";
import { messages } from "./messages";

/** Toutes les clés « a.b.c » d'un objet de traduction. */
function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`),
  );
}

function valueAt(obj: object, path: string): string {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as string;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("fichiers de traduction", () => {
  const reference = keys(messages.fr);

  it.each(LOCALES)("%s contient exactement les mêmes clés que fr", (locale) => {
    expect(keys(messages[locale]).sort()).toEqual([...reference].sort());
  });

  it.each(LOCALES)("%s n'a aucun texte vide", (locale) => {
    for (const key of reference) expect(valueAt(messages[locale], key).trim(), key).not.toBe("");
  });

  it("les {variables} sont les mêmes dans toutes les langues", () => {
    for (const key of reference) {
      for (const locale of LOCALES) {
        expect(placeholders(valueAt(messages[locale], key)), `${locale}: ${key}`).toEqual(
          placeholders(valueAt(messages.fr, key)),
        );
      }
    }
  });

  it("toutes les {variables} des erreurs sont remplies", () => {
    for (const locale of LOCALES) {
      for (const code of Object.keys(messages.fr.errors) as (keyof typeof messages.fr.errors)[]) {
        expect(errorText(messages[locale], code), `${locale}: ${code}`).not.toMatch(/\{\w+\}/);
      }
    }
  });
});

describe("format", () => {
  it("remplace les variables fournies et les limites", () => {
    expect(format("Salle {code}", { code: "ABCDEF" })).toBe("Salle ABCDEF");
    expect(format("{usernameMin}-{usernameMax}")).toBe("3-24");
  });

  it("laisse une variable inconnue telle quelle", () => {
    expect(format("{inconnue}")).toBe("{inconnue}");
  });
});
