import { expect, test, type Page } from "@playwright/test";

async function startShortRace(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Nom d'utilisateur", { exact: true }).fill(`course-${crypto.randomUUID().slice(0, 18)}`);
  await page.getByLabel("Mot de passe", { exact: true }).fill("Password-e2e-123");
  await page.getByLabel("Confirmer le mot de passe").fill("Password-e2e-123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Créer une salle" }).click();
  await expect(page.getByText("En direct", { exact: true })).toBeVisible();
  await page.getByLabel("Niveau du bot").selectOption("IMPOSSIBLE");
  await page.getByRole("button", { name: "Ajouter un bot" }).click();
  await expect(page.getByText("bot", { exact: true })).toBeVisible();
  await page.getByLabel("Type de texte").selectOption("ALEATOIRE");
  await page.getByLabel("Complexité", { exact: true }).selectOption("FACILE");
  await page.getByLabel("Nombre de mots").fill("10");
  for (const name of ["Ponctuation", "Chiffres", "Majuscules", "Accents", "Bonus activés"]) {
    await page.getByLabel(name, { exact: true }).uncheck();
  }
  await page.getByRole("button", { name: "Enregistrer la configuration" }).click();
  await expect(page.getByLabel("Nombre de mots")).toHaveValue("10");
  await expect(page.getByRole("button", { name: "Lancer la course" })).toBeEnabled();
  await page.getByRole("button", { name: "Lancer la course" }).click();
  await expect(page.getByRole("status", { name: "Décompte" })).toBeVisible();
  await expect(page.getByLabel("Zone de frappe", { exact: true })).toBeEnabled({ timeout: 10000 });
}

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
