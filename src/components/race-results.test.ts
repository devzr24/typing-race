import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import type { ResultRow } from "@/lib/race/results-visuals";
import { RaceResults } from "./race-results";

vi.mock("@/i18n/client", () => ({ useI18n: vi.fn() }));

const result: ResultRow = {
  id: "human", name: "Runner", image: null, isBot: false, rank: 1,
  netMpm: 50, grossMpm: 55, accuracy: 98, errors: 3, elapsedMs: 60_000,
  status: "finished", bonuses: [], series: [], missedKeys: { a: 1, b: 2 }, raceId: "saved-race", isPersonalBest: false,
};

function render(locale: Locale, canOpen?: boolean, raceId = result.raceId) {
  vi.mocked(useI18n).mockReturnValue({ locale, m: messages[locale] });
  return renderToStaticMarkup(createElement(RaceResults, { results: [{ ...result, raceId }], selfId: result.id, canOpen }));
}

describe("résultats de course", () => {
  it.each([undefined, false, true])("affiche le lien enregistré uniquement avec canOpen=true (%s)", (canOpen) => {
    expect(render("fr", canOpen).includes('href="/races/saved-race"')).toBe(canOpen === true);
  });

  it("attend un identifiant enregistré avant d'afficher le lien", () => {
    expect(render("fr", true, "")).not.toContain('href="/races/');
  });

  it.each([
    ["fr", "a : 1 erreur", "b : 2 erreurs"],
    ["en", "a: 1 error", "b: 2 errors"],
  ] as const)("accorde le nombre d'erreurs en %s", (locale, one, other) => {
    const html = render(locale);
    expect(html).toContain(`title="${one}"`);
    expect(html).toContain(`title="${other}"`);
    expect(html).toContain(`<span class="sr-only">${one.slice(1)}</span>`);
    expect(html).toContain(`<span class="sr-only">${other.slice(1)}</span>`);
  });
});
