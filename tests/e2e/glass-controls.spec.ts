import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

test("custom dropdown keyboard, typeahead, dismissal and chart period work", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  const side = page.getByRole("combobox", { name: "Filter side", exact: true });
  await side.focus();
  await side.press("End");
  await expect(side).toHaveAttribute("aria-expanded", "true");
  await side.press("Enter");
  await expect(side).toHaveText("Sell");
  await side.press("Home");
  await side.press("Enter");
  await expect(side).toHaveText("All sides");
  await side.press("ArrowDown");
  await side.press("ArrowDown");
  await side.press("Enter");
  await expect(side).toHaveText("Buy");
  await side.click();
  await side.press("Escape");
  await expect(side).toHaveAttribute("aria-expanded", "false");
  await expect(side).toBeFocused();
  await side.click();
  await page.setViewportSize({ width: 1200, height: 1000 });
  await expect(side).toHaveAttribute("aria-expanded", "false");
  await side.click();
  await page
    .getByRole("heading", { name: "Trade blotter", exact: false })
    .click();
  await expect(side).toHaveAttribute("aria-expanded", "false");
  const symbol = page.getByRole("combobox", {
    name: "Filter symbol",
    exact: true,
  });
  await symbol.focus();
  await symbol.press("i");
  await symbol.press("n");
  await symbol.press("Enter");
  await expect(symbol).toHaveText("INFY");
  await expect(page.locator("tbody tr").first()).toContainText("INFY");
  await expect(page.locator("tbody tr").first()).toContainText("Buy");
  const before = await page.locator(".chart-summary strong").innerText();
  await page.getByRole("combobox", { name: "Chart period" }).click();
  await page.getByRole("option", { name: "Last hour", exact: true }).click();
  expect(await page.locator(".chart-summary strong").innerText()).not.toBe(
    before,
  );
  await page.getByRole("button", { name: "Pull trades", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Simulated import duration" })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("visible arrows sort, paginate, filter symbols and workspace actions export real data", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);
  const first = await page.locator("tbody tr").first().innerText();
  const sort = page.getByRole("button", { name: "Sort trades by time" });
  await sort.click();
  await expect(page.locator("th[aria-sort]")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  expect(await page.locator("tbody tr").first().innerText()).not.toBe(first);
  await sort.click();
  await expect(page.locator("tbody tr").first()).toHaveText(first, {
    useInnerText: true,
  });
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await expect(page.locator("tbody tr").first()).toHaveText(first, {
    useInnerText: true,
  });
  const asset = page.getByRole("button", {
    name: "Filter trades for RELIANCE",
    exact: true,
  });
  await asset.click();
  await expect(asset).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("combobox", { name: "Filter symbol" }),
  ).toHaveText("RELIANCE");
  await asset.click();
  await expect(asset).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("Workspace options").click();
  await page
    .getByRole("heading", { name: "A clear view of your trades." })
    .click();
  await expect(page.locator(".workspace-menu")).not.toHaveAttribute("open", "");
  await page.getByLabel("Workspace options").click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export all trades", exact: true })
    .click();
  const file = await downloading;
  const count = Number(
    (await page.getByTestId("trade-count").innerText()).replaceAll(",", ""),
  );
  expect(readFileSync((await file.path())!, "utf8").split("\r\n")).toHaveLength(
    count + 1,
  );
  await page.getByLabel("Workspace options").click();
  await page
    .getByRole("button", { name: "Import activity", exact: true })
    .click();
  await expect(page.locator("#imports")).toHaveAttribute("open", "");
  await page.locator(".import-summary").click();
  await expect(page.locator("#imports")).not.toHaveAttribute("open", "");
  await page.getByRole("link", { name: "Folio home" }).click();
  await expect(page.locator("h1")).toBeInViewport();
});

test("hidden scrollbars retain horizontal buttons, keyboard scrolling and a visible discovery cue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  const region = page.getByRole("region", { name: "Trade table", exact: true });
  await region.scrollIntoViewIfNeeded();
  await expect(page.getByText("Swipe to explore all columns")).toBeVisible();
  expect(
    await region.evaluate(
      (element) => getComputedStyle(element).scrollbarWidth,
    ),
  ).toBe("none");
  expect(
    await page
      .locator("html")
      .evaluate((element) => getComputedStyle(element).scrollbarWidth),
  ).toBe("none");
  const left = page.getByRole("button", { name: "Scroll table left" });
  const right = page.getByRole("button", { name: "Scroll table right" });
  await expect(left).toBeDisabled();
  await right.click();
  await expect
    .poll(() => region.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  await expect(left).toBeEnabled();
  for (let i = 0; i < 6; i++) {
    const atEnd = await region.evaluate(
      (element) =>
        element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
    );
    if (atEnd) break;
    const before = await region.evaluate((element) => element.scrollLeft);
    await right.click();
    await expect
      .poll(() => region.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(before);
  }
  await expect(right).toBeDisabled();
  await expect(page.getByText("You’ve reached the last column")).toBeVisible();
  await left.click();
  const position = await region.evaluate((element) => element.scrollLeft);
  await region.focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(() => region.evaluate((element) => element.scrollLeft))
    .toBeLessThan(position);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("the pinned liquid-glass library generates maps, cleans up dialogs, and black mode stays black", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/");
  await expect
    .poll(() => page.locator('filter[id^="lg-filter-"]').count())
    .toBeGreaterThan(0);
  expect(
    await page
      .locator(".topbar")
      .evaluate((element) => (element as HTMLElement).style.backdropFilter),
  ).toContain("url(");
  await expect
    .poll(() =>
      page
        .locator('filter[id^="lg-filter-"] feImage[href^="data:image/png"]')
        .count(),
    )
    .toBeGreaterThan(0);
  expect(
    await page
      .locator("body")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(0, 0, 0)");
  const baseline = await page.locator('filter[id^="lg-filter-"]').count();
  await page.getByRole("button", { name: "Pull trades", exact: true }).click();
  await expect
    .poll(() => page.locator('filter[id^="lg-filter-"]').count())
    .toBeGreaterThan(baseline);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect
    .poll(() => page.locator('filter[id^="lg-filter-"]').count())
    .toBe(baseline);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.locator("html").evaluate((element, value) => {
        element.dataset.theme = value;
      }, theme);
      await page.getByRole("combobox", { name: "Chart period" }).click();
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(scan.violations).toEqual([]);
      await page.keyboard.press("Escape");
    }
  }
  expect(errors).toEqual([]);
});
