import { expect, test } from "@playwright/test";
import sharp from "sharp";

// Même isolation des IP que race.spec.ts : cinq inscriptions par IP et par heure.
test.beforeEach(async ({ page }) => {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
});

test("profil modifié sans reconnexion puis historique d’une course", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/register");
  await page.getByLabel("Nom d'utilisateur", { exact: true }).fill(`profil-${crypto.randomUUID().slice(0, 18)}`);
  await page.getByLabel("Mot de passe", { exact: true }).fill("Password-e2e-123");
  await page.getByLabel("Confirmer le mot de passe").fill("Password-e2e-123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL("/");

  const header = page.getByRole("banner");
  await header.getByRole("link", { name: "Historique", exact: true }).click();
  await expect(page.getByText("Tu n’as pas encore participé à une course.")).toBeVisible();
  await header.getByRole("link", { name: "Profil", exact: true }).click();
  const name = `joueur-${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel("Pseudonyme d’affichage", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Enregistrer le pseudonyme" }).click();
  await expect(header.getByText(name, { exact: true })).toBeVisible();

  const image = await sharp({ create: { width: 8, height: 6, channels: 3, background: "red" } }).png().toBuffer();
  await page.getByLabel("Photo de profil", { exact: true }).setInputFiles({
    name: "photo.png", mimeType: "image/png", buffer: image,
  });
  await page.getByRole("button", { name: "Téléverser la photo" }).click();
  const avatar = header.locator("img");
  await expect(avatar).toHaveAttribute("src", /(?:\/|%2F)api(?:\/|%2F)avatars(?:\/|%2F)/);
  await expect.poll(() => avatar.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.reload();
  await expect(header.getByText(name, { exact: true })).toBeVisible();

  // Configuration de course courte identique au helper startShortRace de race.spec.ts.
  await page.goto("/");
  await page.getByRole("button", { name: "Créer une salle" }).click();
  await expect(page.getByText("En direct", { exact: true })).toBeVisible();
  await page.getByLabel("Niveau du bot").selectOption("IMPOSSIBLE");
  await page.getByRole("button", { name: "Ajouter un bot" }).click();
  await expect(page.getByText("bot", { exact: true })).toBeVisible();
  await page.getByLabel("Type de texte").selectOption("ALEATOIRE");
  await page.getByLabel("Complexité").selectOption("FACILE");
  await page.getByLabel("Nombre de mots").fill("10");
  for (const label of ["Ponctuation", "Chiffres", "Majuscules", "Accents", "Bonus activés"]) {
    await page.getByLabel(label, { exact: true }).uncheck();
  }
  await page.getByRole("button", { name: "Enregistrer la configuration" }).click();
  await expect(page.getByRole("button", { name: "Lancer la course" })).toBeEnabled();
  await page.getByRole("button", { name: "Lancer la course" }).click();
  await expect(page.getByLabel("Zone de frappe", { exact: true })).toBeEnabled({ timeout: 10000 });
  const text = await page.getByRole("region", { name: "Texte de la course" }).innerText();
  await page.getByLabel("Zone de frappe", { exact: true }).focus();
  await page.keyboard.type(text, { delay: 40 });
  const persisted = page.getByRole("link", { name: "Ouvrir les résultats enregistrés" });
  await expect(persisted).toBeVisible({ timeout: 30000 });
  const resultUrl = await persisted.getAttribute("href");
  await header.getByRole("link", { name: "Historique", exact: true }).click();
  const rows = page.getByRole("table", { name: "Historique", exact: true }).locator("tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.getByRole("link")).toHaveAttribute("href", resultUrl!);
  await rows.getByRole("link").click();
  await expect(page).toHaveURL(resultUrl!);
  await expect(page.getByRole("table", { name: "Classement complet" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Classement complet" }).getByText(name, { exact: true })).toBeVisible();
});
