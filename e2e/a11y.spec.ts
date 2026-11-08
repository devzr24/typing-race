import AxeBuilder from "@axe-core/playwright";

// Le logo est exclu : WCAG 1.4.3 exempte les logotypes, et son grésillement néon fait varier sa couleur
// d'une image à l'autre (mesure instable). Tout le reste de la page est audité.
const axe = (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude(".logo-neon");
import { expect, test, type Page } from "@playwright/test";
import { startShortRace } from "./helpers/race";

async function audit(page: Page) {
  // Attend la fin de l'entrée de page et les polices avant le calcul des contrastes.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((animation) =>
      animation.effect?.getTiming().iterations !== Infinity,
    ).map((animation) => animation.finished.catch(() => {})));
  });
  const results = await axe(page).analyze();
  expect(results.violations).toEqual([]);
  await expect(page.getByRole("main")).toHaveAttribute("id", "contenu");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
}

for (const theme of ["light", "dark"]) {
  test.describe(`accessibilité — ${theme}`, () => {
    test.beforeEach(async ({ page, context, baseURL }) => {
      const octet = () => Math.floor(Math.random() * 254) + 1;
      await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
      await context.addCookies([{ name: "theme", value: theme, url: baseURL ?? "http://localhost:3100" }]);
    });

    for (const route of ["/", "/login", "/register", "/salles"]) {
      test(`WCAG AA ${route}`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
        await audit(page);
      });
    }

    test("salle, frappe, dialogue, résultats, profil et historique", async ({ page }) => {
      test.setTimeout(120000);
      await startShortRace(page, () => audit(page));
      const input = page.getByLabel("Zone de frappe", { exact: true });
      await expect(input).toBeFocused();
      await audit(page);
      // Depuis le champ, Tab atteint Abandonner ; le dialogue suit l'ordre natif.
      await input.focus();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Abandonner", exact: true })).toBeFocused();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      const cancel = dialog.getByRole("button", { name: "Annuler", exact: true });
      await expect(cancel).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: "Abandonner", exact: true })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(cancel).toBeFocused();
      const violations = await axe(page).analyze();
      expect(violations.violations).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(input).toBeFocused();
      const text = await page.getByRole("region", { name: "Texte de la course" }).innerText();
      await page.keyboard.type(text, { delay: 40 });
      const persisted = page.getByRole("link", { name: "Ouvrir les résultats enregistrés" });
      await expect(persisted).toBeVisible({ timeout: 30000 });
      await audit(page);
      await persisted.click();
      await expect(page).toHaveURL(/\/races\/[^/]+$/);
      await expect(page.getByRole("table", { name: "Classement complet" })).toBeVisible();
      await audit(page);
      for (const route of ["/profile", "/history"]) {
        await page.goto(route);
        await expect(page).toHaveURL(route);
        await audit(page);
      }
    });

    test("lien d’évitement et formulaire au clavier", async ({ page }) => {
      await page.goto("/register");
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Aller au contenu" });
      await expect(skip).toBeFocused();
      const focus = await skip.evaluate((element) => {
        const style = getComputedStyle(element);
        return { visible: element.matches(":focus-visible"), style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
      });
      expect(focus).toMatchObject({ visible: true, style: "solid" });
      expect(focus.width).toBeGreaterThanOrEqual(2);
      await expect(skip).toBeInViewport();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Nom d'utilisateur", { exact: true })).toBeFocused();
      await page.keyboard.type("clavier");
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Mot de passe", { exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Confirmer le mot de passe")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeFocused();
    });
  });
}
