import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("desktop filters, pagination, CSV, theme persistence and accessible dialog", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("trade-count")).not.toHaveText("—");
  const firstTrade = await page.locator("tbody tr").first().innerText();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  expect(await page.locator("tbody tr").first().innerText()).not.toEqual(
    firstTrade,
  );
  await page.getByLabel("Search trades").fill("RELIANCE");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  for (const row of await page.locator("tbody tr").all())
    await expect(row).toContainText("RELIANCE");
  await choose(page, "Filter side", "Buy");
  await expect(page.locator("tbody tr").first()).toContainText("Buy");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toEqual("folio-trades.csv");
  await page.getByLabel("Search trades").fill("DOESNOTEXIST");
  await expect(
    page.getByText("No trades found", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  const theme = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);
  await page.getByLabel("Workspace options").click();
  await page.getByRole("button", { name: "How Folio works" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a 35-second import survives the HTTP limit and updates two open dashboards without polling", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await expect(
    second.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  const before = (await (await request.get("/api/trades")).json()).total;
  const requests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/")) requests.push(req.url());
  });
  await page.getByRole("button", { name: "Pull trades", exact: true }).click();
  await choose(page, "Simulated import duration", "35 seconds · timeout demo");
  const started = Date.now();
  const slowRequest = request
    .get("/getTrades?delayMs=35000", { timeout: 40000 })
    .then(
      () => false,
      () => true,
    );
  await page.getByRole("button", { name: "Start pull", exact: true }).click();
  await expect(
    page.getByText("Pull started. You can keep working.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("trade-count")).toHaveText(
    before.toLocaleString("en-IN"),
  );
  const duplicate = await request.post("/api/pulls", { data: { delayMs: 0 } });
  expect((await duplicate.json()).reused).toBe(true);
  const late = await context.newPage();
  await late.goto("/");
  await expect(late.getByTestId("trade-count")).toHaveText(
    before.toLocaleString("en-IN"),
  );
  await expect(page.getByTestId("trade-count")).toHaveText(
    (before + 5000).toLocaleString("en-IN"),
    { timeout: 55000 },
  );
  await expect(second.getByTestId("trade-count")).toHaveText(
    (before + 5000).toLocaleString("en-IN"),
  );
  await expect(late.getByTestId("trade-count")).toHaveText(
    (before + 5000).toLocaleString("en-IN"),
  );
  expect(Date.now() - started).toBeGreaterThan(30000);
  expect(await slowRequest).toBe(true);
  expect(
    requests.filter(
      (url) => url.includes("/api/trades") || /\/api\/pulls\//.test(url),
    ),
  ).toHaveLength(0);
});

test("API rejects malformed input, excessive delay and foreign origins", async ({
  request,
}) => {
  expect(
    (await request.post("/api/pulls", { data: { delayMs: 900001 } })).status(),
  ).toBe(400);
  expect(
    (await request.post("/api/pulls", { data: { delayMs: -1 } })).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/pulls", {
        data: "{}",
        headers: { "Content-Type": "text/plain" },
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await request.post("/api/pulls", {
        data: {},
        headers: { Origin: "https://foreign.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/pulls", {
        data: "{",
        headers: { "Content-Type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/pulls", {
        data: "null",
        headers: { "Content-Type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  expect((await request.get("/getTrades?page=50")).status()).toBe(400);
  const mock = await (await request.get("/getTrades?delayMs=0")).json();
  expect(mock.trades).toHaveLength(5000);
});

test("mobile layout, navigation, dark mode and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Workspace options").click();
  await page
    .getByRole("button", { name: "Import activity", exact: true })
    .click();
  await expect(page.locator("#imports")).toHaveAttribute("open", "");
  await page
    .locator("html")
    .evaluate((e) => e.setAttribute("data-theme", "dark"));
  await page.screenshot({ path: "artifacts/mobile-dark.png", fullPage: true });
  await page
    .locator("html")
    .evaluate((e) => e.setAttribute("data-theme", "light"));
  await page.screenshot({ path: "artifacts/mobile-light.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/desktop-light.png",
    fullPage: true,
  });
  await page
    .locator("html")
    .evaluate((e) => e.setAttribute("data-theme", "dark"));
  await page.screenshot({ path: "artifacts/desktop-dark.png", fullPage: true });
});

test("themes meet automated WCAG checks and layouts fit mobile", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  for (const theme of ["light", "dark"]) {
    await page.locator("html").evaluate((element, value) => {
      element.dataset.theme = value;
    }, theme);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.getByRole("button", { name: "Pull trades", exact: true }).click();
  const dialog = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(dialog.violations).toEqual([]);
});
