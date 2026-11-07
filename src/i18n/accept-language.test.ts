import { describe, expect, it } from "vitest";
import { localeFromAcceptLanguage } from "./accept-language";
import { DEFAULT_LOCALE } from "./config";

describe("localeFromAcceptLanguage", () => {
  it.each([
    ["fr-CA,fr;q=0.9,en;q=0.8", "fr"],
    ["EN-us", "en"],
    ["fr;q=0.5,en;q=0.9", "en"],
    ["en;q=0.5,fr;q=0.9", "fr"],
    ["fr;q=0.9,en", "en"],
    ["en,fr", "en"],
    ["fr,en", "fr"],
    ["en;q=0.8,fr;q=0.8", "en"],
    ["fr;q=0.8,en;q=0.8", "fr"],
    ["en;q=0,fr;q=0.1", "fr"],
    ["fr;q=0,en;q=0.1", "en"],
    ["de,en;q=0.5", "en"],
    [" fr-CA ; q=0.5 , en-US ; q=0.9 ", "en"],
    ["en;q=oops,fr;q=0.5", "fr"],
    ["fr;q=oops,en;q=0.5", "en"],
    ["en;q=1.1,fr;q=0.5", "fr"],
    ["fr;q=-0.1,en;q=0.5", "en"],
    ["en;q=,fr;q=0.5", "fr"],
    ["en_US,fr;q=0.5", "fr"],
    ["en;q=0.9;foo=bar,fr;q=0.5", "fr"],
    ["*;q=1,en;q=0.5", "en"],
  ])("%s → %s", (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });

  it.each([undefined, null, "", "   ", "*", "*;q=0.5", "de,es;q=0.9", "???", "en;q=0", "en;q=NaN"])(
    "%s utilise la langue par défaut",
    (header) => {
      expect(localeFromAcceptLanguage(header)).toBe(DEFAULT_LOCALE);
    },
  );
});
