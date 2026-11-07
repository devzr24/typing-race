import { describe, expect, it } from "vitest";
import { localeSchema, themeSchema } from "./schemas";

describe("schémas des préférences", () => {
  it.each([null, 42, "de", "", { locale: "fr" }])("refuse une langue inconnue : %j", (value) => {
    expect(localeSchema.safeParse(value).success).toBe(false);
  });
  it.each([null, 42, "blue", "", { theme: "dark" }])("refuse un thème inconnu : %j", (value) => {
    expect(themeSchema.safeParse(value).success).toBe(false);
  });
  it("accepte les préférences proposées", () => {
    for (const locale of ["fr", "en"]) expect(localeSchema.parse(locale)).toBe(locale);
    for (const theme of ["light", "dark", "system"]) expect(themeSchema.parse(theme)).toBe(theme);
  });
});
