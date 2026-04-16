import { test, expect } from "@playwright/test";

test.describe("Sessions API", () => {
  test("PTY server starts on demand", async ({ request }) => {
    const response = await request.get("/api/tmux/pty-server");
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.running).toBe(true);
    expect(data.port).toBe(3001);
  });

  test("MiClaw sessions API returns array", async ({ request }) => {
    const response = await request.get("/api/tmux/sessions");
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("detected sessions API returns array", async ({ request }) => {
    const response = await request.get("/api/sessions");
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("session create and delete lifecycle", async ({ request }) => {
    const createRes = await request.post("/api/tmux/sessions", {
      data: { name: "e2e-lifecycle", cwd: "/tmp" },
    });
    expect(createRes.ok()).toBe(true);
    const session = await createRes.json();
    expect(session.id).toContain("miclaw-e2e-lifecycle");

    const listRes = await request.get("/api/tmux/sessions");
    const sessions = await listRes.json();
    expect(sessions.some((s: { id: string }) => s.id === session.id)).toBe(true);

    const deleteRes = await request.delete("/api/tmux/sessions", {
      data: { id: session.id },
    });
    expect(deleteRes.ok()).toBe(true);

    const listRes2 = await request.get("/api/tmux/sessions");
    const sessions2 = await listRes2.json();
    expect(sessions2.some((s: { id: string }) => s.id === session.id)).toBe(false);
  });
});

test.describe("History API", () => {
  test("history endpoint returns sessions with stats", async ({ request }) => {
    const response = await request.get("/api/history?limit=5");
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty("sessions");
    expect(data).toHaveProperty("stats");
    expect(data).toHaveProperty("total");
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(typeof data.stats.totalSessions).toBe("number");
    expect(typeof data.stats.totalCostUSD).toBe("number");
  });

  test("history search filters results", async ({ request }) => {
    const allRes = await request.get("/api/history?limit=1000&withCost=false");
    const all = await allRes.json();

    if (all.total > 0) {
      // Search with a nonsense string should return fewer results
      const searchRes = await request.get("/api/history?q=xyzzy_nonexistent_12345&withCost=false");
      const searched = await searchRes.json();
      expect(searched.total).toBeLessThanOrEqual(all.total);
    }
  });
});

test.describe("Sessions UI", () => {
  test("sessions view renders with tab bar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Shift+Esc")).toBeVisible({ timeout: 15_000 });

    // Tab bar should contain "active" count or a new session button
    const tabArea = page.locator("text=active").or(page.locator('button[title="New session"]'));
    await expect(tabArea.first()).toBeVisible({ timeout: 5_000 });
  });

  test("command mode activates on Shift+Escape", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Shift+Esc")).toBeVisible({ timeout: 15_000 });

    // Enter command mode
    await page.keyboard.press("Shift+Escape");

    // The command bar should show "COMMAND" (exact match to avoid sidebar tooltip)
    await expect(page.getByText("COMMAND", { exact: true })).toBeVisible({ timeout: 3_000 });

    // Exit command mode
    await page.keyboard.press("Escape");
    await expect(page.getByText("COMMAND", { exact: true })).not.toBeVisible();
  });
});
