import { expect, type Page } from "@playwright/test";

export async function prepareRace(page: Page, { wordCount = 10, capacity, botLevels = ["IMPOSSIBLE"] }: {
  wordCount?: number; capacity?: number; botLevels?: string[];
} = {}) {
  await page.goto("/register");
  await page.getByLabel("Nom d'utilisateur", { exact: true }).fill(`course-${crypto.randomUUID().slice(0, 18)}`);
  await page.getByLabel("Mot de passe", { exact: true }).fill("Password-e2e-123");
  await page.getByLabel("Confirmer le mot de passe").fill("Password-e2e-123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Créer une salle" }).click();
  await expect(page.getByText("En direct", { exact: true })).toBeVisible();
  if (capacity !== undefined) {
    await page.getByLabel("Capacité", { exact: true }).fill(String(capacity));
    await page.getByRole("button", { name: "Enregistrer l’accès" }).click();
    await expect(page.getByRole("button", { name: "Ajouter un bot" })).toBeEnabled();
    await expect(page.getByLabel("Capacité", { exact: true })).toHaveValue(String(capacity));
  }
  for (const [index, level] of botLevels.entries()) {
    await page.getByLabel("Niveau du bot").selectOption(level);
    await page.getByRole("button", { name: "Ajouter un bot" }).click();
    await expect(page.getByText("bot", { exact: true })).toHaveCount(index + 1);
  }
  await page.getByLabel("Type de texte").selectOption("ALEATOIRE");
  await page.getByLabel("Complexité").selectOption("FACILE");
  await page.getByLabel("Nombre de mots").fill(String(wordCount));
  for (const name of ["Ponctuation", "Chiffres", "Majuscules", "Accents", "Bonus activés"]) {
    await page.getByLabel(name, { exact: true }).uncheck();
  }
  await page.getByRole("button", { name: "Enregistrer la configuration" }).click();
  await expect(page.getByLabel("Nombre de mots")).toHaveValue(String(wordCount));
  await expect(page.getByRole("button", { name: "Lancer la course" })).toBeEnabled();
}

export async function launchRace(page: Page) {
  await page.getByRole("button", { name: "Lancer la course" }).click();
  await expect(page.getByRole("status", { name: "Décompte" })).toBeVisible();
  await expect(page.getByLabel("Zone de frappe", { exact: true })).toBeEnabled({ timeout: 10000 });
}

export async function startShortRace(page: Page, beforeStart?: () => Promise<void>) {
  await prepareRace(page);
  await beforeStart?.();
  await launchRace(page);
}
