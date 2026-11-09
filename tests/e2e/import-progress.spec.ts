import { test, expect, type WebSocketRoute } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("live import activity is animated, inspectable and settles into a dismissible completion", async ({
  page,
  request,
}) => {
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket("**/ws", (route) => {
    socket = route;
    route.connectToServer();
  });
  await page.emulateMedia({
    reducedMotion: "no-preference",
    colorScheme: "dark",
  });
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  const before = (await (await request.get("/api/trades")).json()).total;
  await page.getByRole("button", { name: "Pull trades", exact: true }).click();
  await page.getByRole("button", { name: "Start pull", exact: true }).click();
  const card = page.getByRole("region", {
    name: "Trade import progress",
    exact: true,
  });
  await expect(card).toBeVisible();
  await expect(
    card.getByRole("heading", { name: "Importing your trades" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Pull in progress/ }),
  ).toBeEnabled();
  await expect(card.locator(".import-orbit")).toHaveCSS(
    "animation-name",
    "import-orbit",
  );
  await expect
    .poll(async () =>
      Number(await card.getByRole("progressbar").getAttribute("aria-valuenow")),
    )
    .toBeGreaterThan(0);
  await expect(card).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "artifacts/import-progress-desktop.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: /^Pull in progress/ }).click();
  const dialog = page.getByRole("dialog", {
    name: "Import progress",
    exact: true,
  });
  await expect(
    dialog.getByRole("heading", { name: "Importing your trades" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keep exploring", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await socket!.close({ code: 1000, reason: "Progress reconnection check" });
  await expect(card.getByText("Reconnecting", { exact: true })).toBeVisible();
  await expect(card.locator(".import-orbit")).toHaveCSS(
    "animation-play-state",
    "paused",
  );
  await expect(card.getByText("In progress", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "View import progress", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await page.getByLabel("Search trades").fill("INFY");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await expect(card).toHaveAttribute("data-import-state", "completed", {
    timeout: 22000,
  });
  await expect(
    card.getByRole("heading", { name: "Your trades are ready" }),
  ).toBeVisible();
  await expect(card.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(card.locator(".import-orbit")).toHaveCount(0);
  await expect(page.getByTestId("trade-count")).toHaveText(
    (before + 5000).toLocaleString("en-IN"),
  );
  await page.getByRole("button", { name: "Dismiss import update" }).click();
  await expect(card).toHaveCount(0);
});

test("mobile import progress respects reduced motion and remains accessible", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  await request.post("/api/pulls", { data: { delayMs: 12000 } });
  const card = page.getByRole("region", {
    name: "Trade import progress",
    exact: true,
  });
  await expect(card).toHaveAttribute("data-import-state", "running");
  await expect(card.locator(".import-orbit")).toHaveCSS(
    "animation-name",
    "none",
  );
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "artifacts/import-progress-mobile.png",
    fullPage: false,
  });
  const initial = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(initial.violations).toEqual([]);
  await card.getByRole("button", { name: "View progress" }).click();
  const dialog = page.getByRole("dialog", { name: "Import progress" });
  await expect(dialog).toBeVisible();
  const detail = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(detail.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card).toHaveAttribute("data-import-state", "completed", {
    timeout: 22000,
  });
});
