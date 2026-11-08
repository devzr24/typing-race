import { expect, test, type Page } from "@playwright/test";
import { launchRace, prepareRace } from "./helpers/race";

async function expectNoHorizontalScroll(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
      && document.body.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
}

test.beforeEach(async ({ page }) => {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
});

test.describe("DES-06 — mobile tactile", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("accueil, connexion et salle sans débordement, piste accessible en course", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    await expect(page.getByRole("button", { name: "Faire une course", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rejoindre", exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole("link", { name: "Connexion", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Connexion", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuer en invité", exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await prepareRace(page, { wordCount: 40, botLevels: ["NOOB"] });
    await expect(page.getByRole("button", { name: "Lancer la course", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitter la salle", exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await launchRace(page);
    await expect(page.getByText("Clavier physique recommandé", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Zone de frappe", { exact: true })).toBeHidden();
    await expect(page.getByRole("region", { name: "Texte de la course" })).toBeHidden();
    const track = page.getByRole("region", { name: "Piste de course" });
    await expect(track).toBeVisible();
    await expect(track.getByRole("listitem")).toHaveCount(2);
    await expectNoHorizontalScroll(page);
  });
});

test.describe("DES-06 — fenêtre étroite avec pointeur précis", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: false, isMobile: false });

  test("la zone de frappe reste utilisable à 360 px", async ({ page }) => {
    test.setTimeout(60000);
    await prepareRace(page, { wordCount: 40, botLevels: ["NOOB"] });
    await launchRace(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(false);
    await expect(page.getByText("Clavier physique recommandé", { exact: true })).toBeHidden();
    const input = page.getByLabel("Zone de frappe", { exact: true });
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();
    const text = await page.getByRole("region", { name: "Texte de la course" }).innerText();
    await input.focus();
    await page.keyboard.type(text.slice(0, 10), { delay: 50 });
    const self = page.getByRole("region", { name: "Piste de course" }).getByRole("listitem")
      .filter({ has: page.getByText("vous", { exact: true }) });
    await expect(self.getByText(/^[1-9]\d*\s*%$/)).toBeVisible();
    await expect(self.getByText("En course", { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
