import { test, expect, type WebSocketRoute } from "@playwright/test";

test("a failed initial HTTP read cannot invalidate a newer live snapshot", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/trades", async (route) => {
    await gate;
    await route.fulfill({
      status: 503,
      json: { error: "Read temporarily unavailable" },
    });
  });
  await page.goto("/");
  await expect(page.getByTestId("trade-count")).not.toHaveText("—");
  const failedRead = page.waitForResponse((response) =>
    response.url().endsWith("/api/trades"),
  );
  release();
  await failedRead;
  await page.getByLabel("Workspace options").click();
  await expect(
    page.getByRole("button", { name: "How Folio works", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Could not read saved trades.", { exact: true }),
  ).toHaveCount(0);
});

test("reconnecting restores trades published while the socket was disconnected without HTTP polling", async ({
  page,
  request,
}) => {
  let socket: WebSocketRoute | undefined;
  let connections = 0;
  await page.routeWebSocket("**/ws", (route) => {
    socket = route;
    connections++;
    route.connectToServer();
  });
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  const before = (await (await request.get("/api/trades")).json()).total;
  const browserReads: string[] = [];
  page.on("request", (incoming) => {
    if (incoming.url().includes("/api/")) browserReads.push(incoming.url());
  });
  await socket!.close({ code: 1000, reason: "Reconnect verification" });
  await expect(
    page.getByText("Reconnecting updates", { exact: true }),
  ).toBeVisible();
  const accepted = await request.post("/api/pulls", { data: { delayMs: 0 } });
  expect(accepted.status()).toBe(202);
  await expect(page.getByTestId("trade-count")).toHaveText(
    (before + 5000).toLocaleString("en-IN"),
  );
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  expect(connections).toBeGreaterThan(1);
  expect(browserReads).toHaveLength(0);
});

test("a late acceptance response cannot regress an already completed import", async ({
  page,
  request,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/pulls", async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  await page.goto("/");
  await expect(
    page.getByText("Updates connected", { exact: true }),
  ).toBeVisible();
  const before = (await (await request.get("/api/trades")).json()).total;
  await page.getByRole("button", { name: "Pull trades", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Simulated import duration" })
    .click();
  await page
    .getByRole("option", { name: "No delay · instant import", exact: true })
    .click();
  await page.getByRole("button", { name: "Start pull", exact: true }).click();
  try {
    await expect(page.getByTestId("trade-count")).toHaveText(
      (before + 5000).toLocaleString("en-IN"),
    );
  } finally {
    release();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pull trades", exact: true }),
  ).toBeEnabled();
});
