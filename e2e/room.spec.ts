import { expect, test, type Page } from "@playwright/test";

/** Depuis l'accueil : page de connexion → « Continuer en invité » → retour à l'accueil. */
async function continueAsGuest(page: Page, pseudo = "invite-e2e") {
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Connexion" }).click();
  await page.getByLabel("Pseudo temporaire").fill(pseudo);
  await page.getByRole("button", { name: "Continuer en invité" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("banner").getByText("(invité)")).toBeVisible();
}

async function registerHost(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Nom d'utilisateur", { exact: true }).fill(`hote-${crypto.randomUUID().slice(0, 18)}`);
  await page.getByLabel("Mot de passe", { exact: true }).fill("Password-e2e-123");
  await page.getByLabel("Confirmer le mot de passe").fill("Password-e2e-123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL("/");
}

async function createRoom(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Créer une salle" }).click();
  await expect(page).toHaveURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);
  return page.url().split("/room/")[1];
}

test("accueil → inscription → créer une salle → le code s'affiche", async ({ page }) => {
  await registerHost(page);
  const code = await createRoom(page);

  // Le code visible est animé (décodage) ; on attend qu'il affiche le code exact.
  // (Un second exemplaire, réservé aux lecteurs d'écran, contient toujours le code.)
  const visibleCode = page.locator('span[aria-hidden="true"]', { hasText: new RegExp(`^${code}$`) });
  await expect(visibleCode).toBeVisible();
  await expect(page.getByText(code, { exact: true }).first()).toBeAttached();
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

  await registerHost(host);
  await host.getByRole("radio", { name: "Spectateur seulement" }).check();
  const code = await createRoom(host);
  await expect(host.getByText("En direct")).toBeVisible();

  // Le joueur rejoint avec le code tapé en minuscules.
  await continueAsGuest(player, "joueur-e2e");
  await player.getByLabel("Rejoindre avec un code").fill(code.toLowerCase());
  await player.getByRole("button", { name: "Rejoindre" }).click();
  await expect(player).toHaveURL(`/room/${code}`);

  await expect(host.getByText("spectateur", { exact: true })).toBeVisible();
  await expect(player.getByText("spectateur", { exact: true })).toBeVisible();
  await expect(player.getByRole("listitem").filter({ hasText: "joueur-e2e" }).getByText("spectateur", { exact: true })).toHaveCount(0);

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

test("configuration et décompte synchronisés dans deux navigateurs", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const player = await playerContext.newPage();
    await registerHost(host);
    const code = await createRoom(host);
    await continueAsGuest(player, "course-e2e");
    await player.getByLabel("Rejoindre avec un code").fill(code);
    await player.getByRole("button", { name: "Rejoindre", exact: true }).click();
    await expect(player).toHaveURL(`/room/${code}`);
    await expect(host.getByText("En direct", { exact: true })).toBeVisible();
    await expect(player.getByText("En direct", { exact: true })).toBeVisible();
    await host.getByLabel("Niveau du bot").selectOption("EXPERT");
    await host.getByRole("button", { name: "Ajouter un bot" }).click();
    await expect(player.getByText("bot", { exact: true })).toBeVisible();
    await expect(player.getByRole("listitem").filter({ hasText: "Bot-" })).toContainText("Expert");
    await host.getByLabel("Type de texte").selectOption("ALEATOIRE");
    await host.getByLabel("Nombre de mots").fill("40");
    await host.getByRole("button", { name: "Enregistrer la configuration" }).click();
    await expect(player.getByLabel("Nombre de mots")).toHaveValue("40");
    await expect(player.getByLabel("Type de texte")).toHaveValue("ALEATOIRE");
    await expect(player.getByLabel("Nombre de mots")).toBeDisabled();
    await host.getByRole("button", { name: "Lancer la course" }).click();
    await Promise.all([
      expect(host.getByRole("status", { name: "Décompte" })).toBeVisible(),
      expect(player.getByRole("status", { name: "Décompte" })).toBeVisible(),
    ]);
    await expect(host.getByRole("region", { name: "Texte de la course" })).toBeVisible();
    await expect(player.getByRole("region", { name: "Texte de la course" })).toHaveText(
      await host.getByRole("region", { name: "Texte de la course" }).innerText(),
    );
    await host.getByRole("button", { name: "Fermer la salle" }).click();
    await expect(player.getByRole("main").getByRole("alert")).toHaveText("Cette salle a été fermée.");
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});

test("un invité ne peut pas créer de salle", async ({ page }) => {
  await continueAsGuest(page);
  await expect(page.getByRole("button", { name: "Créer une salle" })).toHaveCount(0);
  await expect(page.getByText("Connecte-toi avec un compte pour créer une salle.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Aller à la page de connexion" })).toHaveAttribute("href", "/login");
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
  await expect(page.getByText("Log in with an account to create a room.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByLabel("Theme").selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  // Après rechargement : la langue et le thème sont conservés, sans flash (classe rendue par le serveur).
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});
