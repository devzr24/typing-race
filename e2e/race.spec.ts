import { expect, test } from "@playwright/test";
import { launchRace, prepareRace, startShortRace } from "./helpers/race";

// Chaque test simule un client distinct : la limite de 5 inscriptions par IP et par heure (SEC-03)
// s'appliquerait sinon à toute la suite, qui tourne depuis la même machine.
test.beforeEach(async ({ page }) => {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
});


test("course complète avec un bot et arrivée du joueur", async ({ page }) => {
  test.setTimeout(60000);
  await startShortRace(page);
  const track = page.getByRole("region", { name: "Piste de course" });
  await expect(track.getByRole("listitem")).toHaveCount(2);
  await expect(track.getByText("bot", { exact: true })).toBeVisible();
  const text = await page.getByRole("region", { name: "Texte de la course" }).innerText();
  expect(text.split(/\s+/)).toHaveLength(10);
  await page.getByLabel("Zone de frappe", { exact: true }).focus();
  await page.keyboard.type(text, { delay: 40 });
  await expect(track.getByRole("listitem").filter({ has: page.getByText("vous", { exact: true }) }).getByText("Arrivé", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Résultat provisoire" })).toContainText("Arrivé");
  await expect(page.getByRole("heading", { name: "Résultats de la course" })).toBeVisible({ timeout: 30000 });
  const podium = page.getByRole("region", { name: "Podium", exact: true });
  const standings = page.getByRole("table", { name: "Classement complet" });
  await expect(podium).toBeVisible();
  await expect(podium.getByRole("listitem")).toHaveCount(2);
  await expect(standings).toBeVisible();
  await expect(standings.getByRole("row")).toHaveCount(3);
  const rows = await standings.locator("tbody tr").allTextContents();
  const podiumText = await podium.textContent();
  await page.getByRole("link", { name: "Ouvrir les résultats enregistrés" }).click();
  await expect(page).toHaveURL(/\/races\/[^/]+$/);
  await expect(page.getByRole("table", { name: "Classement complet" }).locator("tbody tr")).toHaveText(rows);
  await expect(page.getByRole("region", { name: "Podium", exact: true })).toHaveText(podiumText ?? "");
});

test("COURSE-08 — reprendre après rechargement conserve la progression et permet l’arrivée", async ({ page }) => {
  test.setTimeout(60000);
  await prepareRace(page, { wordCount: 40, botLevels: ["NOOB"] });
  await launchRace(page);
  const self = page.getByRole("region", { name: "Piste de course" }).getByRole("listitem")
    .filter({ has: page.getByText("vous", { exact: true }) });
  const input = page.getByLabel("Zone de frappe", { exact: true });
  const text = await page.getByRole("region", { name: "Texte de la course" }).innerText();
  // La dernière frappe change le pourcentage arrondi, donc son affichage confirme tout le préfixe.
  const position = Math.ceil(text.length * 0.245);
  expect(Math.round((position - 1) / text.length * 100)).toBeLessThan(Math.round(position / text.length * 100));
  const percentage = new RegExp(`^${Math.round(position / text.length * 100)}\\s*%$`);
  await input.focus();
  await page.keyboard.type(text.slice(0, position), { delay: 50 });
  // La piste reflète la position confirmée par le serveur, avant le rechargement.
  await expect(self.getByText(percentage)).toBeVisible();
  await expect(self.getByText("En course", { exact: true })).toBeVisible();
  const disconnectedAt = Date.now();
  await page.reload();
  await expect(input).toBeVisible({ timeout: 10000 });
  await expect(input).toBeEnabled({ timeout: 10000 });
  await expect(self.getByText(percentage)).toBeVisible();
  await expect(self.getByText("En course", { exact: true })).toBeVisible();
  expect(Date.now() - disconnectedAt).toBeLessThan(30000);
  await input.focus();
  await page.keyboard.type(text.slice(position), { delay: 50 });
  await expect(self.getByText("Arrivé", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Résultat provisoire" })).toContainText("Arrivé");
});

test("BONUS-03 — annonce du bonus au joueur retardataire", async ({ page }) => {
  test.setTimeout(60000);
  await prepareRace(page, { wordCount: 100, bonusesEnabled: true });
  await launchRace(page);
  const track = page.getByRole("region", { name: "Piste de course" });
  const self = track.getByRole("listitem").filter({ has: page.getByText("vous", { exact: true }) });
  const bot = track.getByRole("listitem").filter({ has: page.getByText("bot", { exact: true }) });
  const text = await page.getByRole("region", { name: "Texte de la course" }).innerText();
  await page.getByLabel("Zone de frappe", { exact: true }).focus();
  await page.keyboard.type(text[0]);
  await expect(bot.getByText(/^[1-9]\d*\s*%$/)).toBeVisible();
  await expect(self.getByText("En course", { exact: true })).toBeVisible();
  // engine.ts consomme les seuils lorsque le meneur les franchit, même si le dernier reste sous 25 %.
  await expect(self.getByText(/^(?:a déclenché : )?(?:−3 mots|\+3 mots pour le meneur|Brouillard)$/))
    .toBeVisible({ timeout: 30000 });
  // Le joueur franchit ensuite lui-même 25 %, quelle que soit la modification de son texte.
  const currentText = await page.getByRole("region", { name: "Texte de la course" }).innerText();
  const position = Math.ceil(currentText.length * 0.26);
  await page.keyboard.type(currentText.slice(1, position), { delay: 100 });
  await expect(self.getByText(/^(?:2[6-9]|[3-9]\d|100)\s*%$/)).toBeVisible();
  await expect(self.getByText("En course", { exact: true })).toBeVisible();
});

test("coller et déposer ne font pas progresser le joueur", async ({ page }) => {
  test.setTimeout(60000);
  await startShortRace(page);
  const text = await page.getByRole("region", { name: "Texte de la course" }).innerText();
  const input = page.getByLabel("Zone de frappe", { exact: true });
  const prevented = await input.evaluate((element, text) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", text);
    const paste = new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true });
    const drop = new DragEvent("drop", { dataTransfer: clipboardData, bubbles: true, cancelable: true });
    const beforeInput = new InputEvent("beforeinput", { inputType: "insertFromPaste", data: text, bubbles: true, cancelable: true });
    return [paste, drop, beforeInput].map((event) => !element.dispatchEvent(event));
  }, text);
  expect(prevented).toEqual([true, true, true]);
  const self = page.getByRole("region", { name: "Piste de course" }).getByRole("listitem").filter({ has: page.getByText("vous", { exact: true }) });
  await expect(self).toContainText(/0\s*%/);
  // Une frappe suivante part toujours du premier caractère.
  await input.focus();
  await page.keyboard.type(text[0]);
  await expect(page.getByRole("region", { name: "Texte de la course" }).locator("span").first()).toHaveClass(/text-cyan/);
});

test("abandon avec confirmation puis résultats quand le bot Impossible finit", async ({ page }) => {
  test.setTimeout(60000);
  await startShortRace(page);
  const abandon = page.getByRole("button", { name: "Abandonner", exact: true });
  await abandon.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Zone de frappe", { exact: true })).toBeEnabled();
  await abandon.click();
  await dialog.getByRole("button", { name: "Abandonner", exact: true }).click();
  await expect(page.getByRole("region", { name: "Résultat provisoire" })).toContainText("Abandon");
  await expect(page.getByLabel("Zone de frappe", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Résultat provisoire" })).toContainText("Abandon");
  await expect(page.getByLabel("Zone de frappe", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Résultats de la course" })).toBeVisible({ timeout: 30000 });
});
