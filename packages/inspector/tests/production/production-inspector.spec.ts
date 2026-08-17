import { expect, test } from "@playwright/test";

const LEGACY_CONNECTION_STORAGE_KEY = "jazz-inspector-standalone-config";

test("production Inspector clears direct credentials and remains network-inert", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ key }) => {
      localStorage.setItem(key, JSON.stringify({ adminSecret: "must-be-removed" }));
      window.location.hash = "adminSecret=must-be-removed&appId=legacy-app";
    },
    { key: LEGACY_CONNECTION_STORAGE_KEY },
  );

  const privilegedRequests: string[] = [];
  page.on("request", (request) => {
    if (["fetch", "xhr", "websocket", "eventsource"].includes(request.resourceType())) {
      privilegedRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Inspector unavailable in production" }),
  ).toBeVisible();
  await expect(page.getByText("A trusted backend-for-frontend (BFF) is required.")).toBeVisible();
  await expect(page.locator("input, textarea, select, button")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), LEGACY_CONNECTION_STORAGE_KEY))
    .toBeNull();
  expect(new URL(page.url()).hash).toBe("");
  expect(privilegedRequests).toEqual([]);
});
