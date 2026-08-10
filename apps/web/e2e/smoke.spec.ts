import { expect, test } from "@playwright/test"

test("an unauthenticated visitor is sent to the login page", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()

  // The gate has to actually withhold the console, not merely change the URL.
  await expect(page.getByText("Control tower")).toHaveCount(0)
  await expect(page.getByText("Marketplace health")).toHaveCount(0)
})

test("every console route is closed, not just the home page", async ({ page }) => {
  // Closed by default is the whole point: a route is protected because it
  // exists, not because somebody remembered to protect it.
  for (const route of ["/rfqs", "/bookings", "/operators", "/fleet", "/compliance", "/settings"]) {
    await page.goto(route)
    await expect(page, route).toHaveURL(/\/login/)
  }
})

test("the guest tracking link is not behind the gate", async ({ page }) => {
  // Sixty wedding guests are not going to sign in to find out where the bus
  // is. The token in the URL is the credential, so this route is the one
  // deliberate hole in the proxy matcher — and a redirect here would silently
  // break the feature the plan calls the best organic acquisition channel.
  //
  // No database is reachable in this smoke run, so the page itself cannot
  // render; what is being proved is that the request was never redirected to
  // /login, which is a property of the matcher alone.
  await page.goto("/track/notarealtoken2345")

  await expect(page).not.toHaveURL(/\/login/)
  await expect(page).toHaveURL(/\/track\//)
})

test("the login page is styled by the token stylesheet", async ({ page }) => {
  await page.goto("/login")

  // Proves the generated CSS was built and served — a missing dist/tokens.css
  // leaves this custom property undefined.
  const background = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
  )

  expect(background).not.toBe("")
})
