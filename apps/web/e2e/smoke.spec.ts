import { expect, test } from "@playwright/test"

test("the front page is public, and is the marketplace", async ({ page }) => {
  // The production URL used to show a bare sign-in form, which reads as an
  // app nobody finished. It is now the thing the business actually is.
  await page.goto("/")

  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("whole group")
  await expect(page.getByRole("link", { name: "Ops sign in" })).toBeVisible()
})

test("an unauthenticated visitor cannot reach the console", async ({ page }) => {
  await page.goto("/console")

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()

  // The gate has to actually withhold the console, not merely change the URL.
  await expect(page.getByText("Marketplace health")).toHaveCount(0)
})

test("every console route is closed, not just its home page", async ({ page }) => {
  // Closed by default is the whole point: a route is protected because it
  // exists, not because somebody remembered to protect it.
  for (const route of [
    "/console/rfqs",
    "/console/bookings",
    "/console/operators",
    "/console/fleet",
    "/console/compliance",
    "/console/integrations",
    "/console/settings",
  ]) {
    await page.goto(route)
    await expect(page, route).toHaveURL(/\/login/)
  }
})

test("the guest tracking link is not behind the gate", async ({ page }) => {
  // Sixty wedding guests are not going to sign in to find out where the bus
  // is. The token in the URL is the credential, so this route is a deliberate
  // hole in the proxy matcher — and a redirect here would silently break the
  // feature the plan calls the best organic acquisition channel.
  //
  // No database is reachable in this smoke run, so the page itself cannot
  // render; what is being proved is that the request was never redirected to
  // /login, which is a property of the matcher alone.
  await page.goto("/track/notarealtoken2345")

  await expect(page).not.toHaveURL(/\/login/)
  await expect(page).toHaveURL(/\/track\//)
})

test("ingest and webhook endpoints are reachable without a session", async ({ request }) => {
  // Both authenticate themselves — a device token, an HMAC — so a redirect to
  // /login would mean a driver app or a payment provider silently failing.
  const ping = await request.post("/api/ingest/ping", { data: { positions: [] } })
  expect([400, 401]).toContain(ping.status())

  const hook = await request.post("/api/webhooks/razorpay", { data: {} })
  expect([401, 503]).toContain(hook.status())
})

test("the pages are styled by the token stylesheet", async ({ page }) => {
  await page.goto("/login")

  // Proves the generated CSS was built and served — a missing dist/tokens.css
  // leaves this custom property undefined.
  const background = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
  )

  expect(background).not.toBe("")
})
