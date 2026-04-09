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
