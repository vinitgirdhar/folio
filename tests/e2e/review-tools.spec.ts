import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import type { Snapshot } from "../../src/shared/types";

async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("trade-count")).not.toHaveText("—");
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);

function metric(page: Page, panel: Locator, label: string) {
  return panel
    .locator("dl > div")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("dd");
}

test("replay seeks, pauses, restarts and isolates its snapshot while imports arrive", async ({
  page,
  request,
}) => {
  await ready(page);
  const before = (await (await request.get("/api/trades")).json()) as Snapshot;
  const earliest = Math.min(
    ...before.trades.map((trade) => Date.parse(trade.timestamp)),
  );
  const firstCount = before.trades.filter(
    (trade) => Date.parse(trade.timestamp) === earliest,
  ).length;
  const counter = page.getByTestId("trade-count");
  await page.getByRole("button", { name: "Start replay", exact: true }).click();
  const replay = page.getByRole("region", {
    name: "Session replay",
    exact: true,
  });
  const seek = replay.getByRole("slider", { name: "Replay time", exact: true });
  await expect(counter).toHaveText(firstCount.toLocaleString("en-IN"));
  await seek.focus();
  await seek.press("ArrowRight");
  await expect(seek).toHaveValue(String(earliest + 60000));
  await seek.press("End");
  await expect(counter).toHaveText(before.total.toLocaleString("en-IN"));
  await choose(page, "Replay speed", "300×");
  await replay
    .getByRole("button", { name: "Restart replay", exact: true })
    .click();
  await expect(counter).toHaveText(firstCount.toLocaleString("en-IN"));
  await replay
    .getByRole("button", { name: "Play replay", exact: true })
    .click();
  await expect
    .poll(async () => Number(await seek.inputValue()))
    .toBeGreaterThan(earliest);
  await replay
    .getByRole("button", { name: "Pause replay", exact: true })
    .click();
  const pausedAt = await seek.inputValue();
  await page.waitForTimeout(650);
  expect(await seek.inputValue()).toEqual(pausedAt);
  await seek.focus();
  await seek.press("End");
  const accepted = await request.post("/api/pulls", { data: { delayMs: 0 } });
  expect(accepted.status()).toBe(202);
  await expect(replay).toContainText("5,000 new trades waiting outside replay");
  await expect(counter).toHaveText(before.total.toLocaleString("en-IN"));
  await replay
    .getByRole("button", { name: "Return to all trades", exact: true })
    .click();
  await expect(counter).toHaveText(
    (before.total + 5000).toLocaleString("en-IN"),
  );
  await expect(seek).toHaveCount(0);
});

test("trade inspection shows exact notional and opens the matching client review", async ({
  page,
  request,
}) => {
  await ready(page);
  const snapshot = (await (
    await request.get("/api/trades")
  ).json()) as Snapshot;
  const trade = snapshot.trades[0];
  await page
    .getByRole("button", { name: `Inspect trade ${trade.id}`, exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Trade details",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(trade.id, { exact: true })).toBeVisible();
  await expect(dialog.getByTestId("trade-detail-notional")).toHaveText(
    money(trade.pricePaise * trade.quantity),
  );
  await dialog
    .getByRole("button", { name: "View client trades", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("tbody tr").first()).toBeVisible();
  for (const row of await page.locator("tbody tr").all()) {
    await expect(row.locator("td").nth(2)).toHaveText(trade.client);
  }
});

test("advanced filters reject inverted values and saved views restore all review criteria after reload", async ({
  page,
  request,
}) => {
  await ready(page);
  const snapshot = (await (
    await request.get("/api/trades")
  ).json()) as Snapshot;
  const sample = snapshot.trades.find(
    (trade) => trade.symbol === "INFY" && trade.side === "BUY",
  )!;
  const amount = ((sample.pricePaise * sample.quantity) / 100).toFixed(2);
  await page.getByLabel("Search trades").fill("INFY");
  await choose(page, "Filter symbol", "INFY");
  await choose(page, "Filter side", "Buy");
  const filters = page.getByRole("region", {
    name: "Advanced trade filters",
    exact: true,
  });
  await filters.locator("summary").click();
  await choose(page, "Filter client", sample.client);
  await filters
    .getByLabel("Minimum trade value (₹)", { exact: true })
    .fill(amount);
  await filters
    .getByLabel("Maximum trade value (₹)", { exact: true })
    .fill("0");
  await expect(filters.getByRole("alert")).toContainText(
    "Minimum trade value must not exceed the maximum.",
  );
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await filters
    .getByLabel("Maximum trade value (₹)", { exact: true })
    .fill(amount);
  await filters.getByLabel("From time (IST)", { exact: true }).fill("09:15");
  await filters.getByLabel("To time (IST)", { exact: true }).fill("15:30");
  await filters
    .getByLabel("View name", { exact: true })
    .fill("INFY execution review");
  await filters.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(filters.getByRole("status")).toContainText(
    "Saved “INFY execution review”",
  );
  await page.reload();
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  await filters.locator("summary").click();
  await choose(page, "Saved trade views", "INFY execution review");
  await expect(page.getByLabel("Search trades")).toHaveValue("INFY");
  await expect(
    page.getByRole("combobox", { name: "Filter symbol", exact: true }),
  ).toHaveText("INFY");
  await expect(
    page.getByRole("combobox", { name: "Filter side", exact: true }),
  ).toHaveText("Buy");
  await expect(
    page.getByRole("combobox", { name: "Filter client", exact: true }),
  ).toHaveText(sample.client);
  await expect(
    filters.getByLabel("Minimum trade value (₹)", { exact: true }),
  ).toHaveValue(amount);
  await expect(
    filters.getByLabel("Maximum trade value (₹)", { exact: true }),
  ).toHaveValue(amount);
  await expect(
    filters.getByLabel("From time (IST)", { exact: true }),
  ).toHaveValue("09:15");
  await expect(
    filters.getByLabel("To time (IST)", { exact: true }),
  ).toHaveValue("15:30");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  for (const row of await page.locator("tbody tr").all()) {
    await expect(row.locator("td").nth(2)).toHaveText(sample.client);
    await expect(row.locator("td").nth(6)).toHaveText(
      money(sample.quantity * sample.pricePaise),
    );
  }
  await filters
    .getByRole("button", { name: "Delete saved view", exact: true })
    .click();
  await page.reload();
  await filters.locator("summary").click();
  await page
    .getByRole("combobox", { name: "Saved trade views", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "INFY execution review", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("session insights reconcile turnover and import verification exports only the selected batch", async ({
  page,
  request,
}) => {
  await ready(page);
  const initial = (await (await request.get("/api/trades")).json()) as Snapshot;
  for (const index of [1, 2]) {
    expect(
      (await request.post("/api/pulls", { data: { delayMs: 0 } })).status(),
    ).toBe(202);
    await expect(page.getByTestId("trade-count")).toHaveText(
      (initial.total + index * 5000).toLocaleString("en-IN"),
    );
  }
  const snapshot = (await (
    await request.get("/api/trades")
  ).json()) as Snapshot;
  const insights = page.locator("#insights");
  await expect(insights).not.toHaveAttribute("open");
  await insights.locator("summary").click();
  const buyPaise = snapshot.trades
    .filter((trade) => trade.side === "BUY")
    .reduce((sum, trade) => sum + trade.quantity * trade.pricePaise, 0);
  await expect(
    insights
      .locator(".insights-flow > div")
      .filter({ has: page.getByText("Buy turnover", { exact: true }) })
      .locator("strong"),
  ).toHaveText(money(buyPaise));
  await expect(
    insights.getByRole("heading", {
      name: "Symbol concentration",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    insights
      .getByRole("list", { name: "Top clients by turnover", exact: true })
      .locator("li"),
  ).toHaveCount(5);
  await insights.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/review-tools-desktop.png",
    fullPage: false,
  });
  const audit = page.locator("#import-audit");
  await expect(audit).not.toHaveAttribute("open");
  await audit.locator("summary").click();
  await expect(audit.getByRole("status")).toContainText(
    "Record count reconciled",
  );
  await expect(metric(page, audit, "Distinct trade IDs")).toHaveText("5,000");
  await expect(metric(page, audit, "Duplicate IDs")).toHaveText("0");
  await expect(
    audit.getByRole("heading", { name: /^Compared with batch/ }),
  ).toBeVisible();
  const latest = snapshot.pulls.find((pull) => pull.status === "completed")!;
  const prefix = `BSE-${String(latest.batch).padStart(4, "0")}-`;
  const download = page.waitForEvent("download");
  await audit
    .getByRole("button", { name: "Export batch CSV", exact: true })
    .click();
  const path = await (await download).path();
  expect(path).not.toBeNull();
  const rows = (await readFile(path!, "utf8")).trim().split(/\r?\n/).slice(1);
  expect(rows).toHaveLength(5000);
  expect(new Set(rows.map((row) => row.split(",")[0])).size).toBe(5000);
  expect(rows.every((row) => row.startsWith(prefix))).toBe(true);
});

test("new review panels and trade details fit narrow screens and pass light/dark accessibility checks", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Start replay", exact: true }).click();
  await page
    .getByRole("slider", { name: "Replay time", exact: true })
    .press("End");
  await page
    .getByRole("region", { name: "Advanced trade filters", exact: true })
    .locator("summary")
    .click();
  await page.locator("#insights > summary").click();
  await page.locator("#import-audit > summary").click();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page
        .locator("html")
        .evaluate(
          (element, value) => element.setAttribute("data-theme", value),
          theme,
        );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations).toEqual([]);
      if (width === 390) {
        await page.locator("#insights > summary").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `artifacts/review-tools-mobile-${theme}.png`,
          fullPage: false,
        });
      }
    }
  }
  await page
    .getByRole("button", { name: /^Inspect trade / })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Trade details",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page
      .locator("html")
      .evaluate(
        (element, value) => element.setAttribute("data-theme", value),
        theme,
      );
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.screenshot({
    path: "artifacts/review-tools-trade-details.png",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
