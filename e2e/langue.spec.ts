import { expect, test } from "@playwright/test";

test.describe("navigateur en anglais", () => {
  test.use({ locale: "en-US" });

  test("sans cookie, la langue suit Accept-Language", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText("Log in with an account to create a room.")).toBeVisible();
  });

  test("le cookie de langue reste prioritaire", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "lang", value: "fr", url: baseURL ?? "http://localhost:3100" }]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });
});
