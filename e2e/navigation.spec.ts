import { test, expect } from "@playwright/test";

test.describe("Navigation & Page Load", () => {
  test("home page loads with sessions view", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Shift+Esc")).toBeVisible({ timeout: 15_000 });
  });

  test("direct navigation to agents page", async ({ page }) => {
    // Test direct URL navigation instead of client-side routing
    // (sidebar click can be flaky due to tooltip overlays)
    await page.goto("/agents");
    await expect(page).toHaveURL(/\/agents/);
    await expect(page.locator("text=Application error")).not.toBeVisible();
  });

  test("overview page loads without crashing", async ({ page }) => {
    await page.goto("/overview");
    await page.waitForTimeout(3000);
    await expect(page.locator("text=Application error")).not.toBeVisible();
  });

  test("sessions page loads", async ({ page }) => {
    await page.goto("/sessions");
    await expect(page.getByText("Shift+Esc")).toBeVisible({ timeout: 15_000 });
  });

  test("history page loads with stats and session list", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByText("History")).toBeVisible({ timeout: 15_000 });
    // Stats cards should render
    await expect(page.getByText("SESSIONS")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("EST. COST")).toBeVisible();
    // Search input should be present
    await expect(page.getByPlaceholder("Search sessions...")).toBeVisible();
  });

  test("all config pages load without errors", async ({ page }) => {
    const pages = ["/agents", "/skills", "/commands", "/mcp", "/hooks", "/settings", "/rules"];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(1000);
      await expect(page.locator("text=Application error")).not.toBeVisible();
    }
  });
});
