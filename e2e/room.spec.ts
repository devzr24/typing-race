import { expect, test, type Page } from "@playwright/test";

/** Depuis l'accueil : page de connexion → « Continuer en invité » → retour à l'accueil. */
async function continueAsGuest(page: Page, pseudo?: string) {
  await page.goto("/");
  await page.getByRole("link", { name: "Connexion" }).click();
  if (pseudo) await page.getByLabel("Pseudo temporaire (facultatif)").fill(pseudo);
  await page.getByRole("button", { name: "Continuer en invité" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("banner").getByText("(invité)")).toBeVisible();
}

async function createRoom(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Créer une salle" }).click();
  await expect(page).toHaveURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);
  return page.url().split("/room/")[1];
}

test("accueil → continuer en invité → créer une salle → le code s'affiche", async ({ page }) => {
  await continueAsGuest(page);
  const code = await createRoom(page);

  await expect(page.getByText(code, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copier" })).toBeVisible();
  await expect(page.getByText("En direct")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Participants (1)" })).toBeVisible();
  await expect(page.getByText("hôte", { exact: true })).toBeVisible();
});

test("deux navigateurs : arrivée et départ visibles en direct chez l'hôte", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();

  await continueAsGuest(host, "hote-e2e");
  const code = await createRoom(host);
  await expect(host.getByText("En direct")).toBeVisible();

  // Le joueur rejoint avec le code tapé en minuscules.
  await continueAsGuest(player, "joueur-e2e");
  await player.getByLabel("Rejoindre avec un code").fill(code.toLowerCase());
  await player.getByRole("button", { name: "Rejoindre" }).click();
  await expect(player).toHaveURL(`/room/${code}`);

  // Sans recharger la page, l'hôte voit le joueur arriver…
  await expect(host.getByRole("heading", { name: "Participants (2)" })).toBeVisible();
  await expect(host.getByText("joueur-e2e")).toBeVisible();

  // …puis repartir.
  await player.getByRole("button", { name: "Quitter la salle" }).click();
  await expect(player).toHaveURL("/");
  await expect(host.getByRole("heading", { name: "Participants (1)" })).toBeVisible();
  await expect(host.getByText("joueur-e2e")).toHaveCount(0);

  await hostContext.close();
  await playerContext.close();
});

test("code de salle inexistant : message d'erreur clair", async ({ page }) => {
  await continueAsGuest(page);
  await page.getByLabel("Rejoindre avec un code").fill("ZZZZZZ");
  await page.getByRole("button", { name: "Rejoindre" }).click();
  // Le message est dans notre alerte (Next.js a aussi une zone role="alert" pour les changements de page).
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Aucune salle ne correspond à ce code.");
});

test("langue et thème : choix appliqués et mémorisés", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");

  await page.getByLabel("Langue").selectOption("en");
  await expect(page.getByRole("button", { name: "Create a room" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByLabel("Theme").selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  // Après rechargement : la langue et le thème sont conservés, sans flash (classe rendue par le serveur).
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});
