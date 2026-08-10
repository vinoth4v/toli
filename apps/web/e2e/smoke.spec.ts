import { expect, test } from "@playwright/test"

test("an unauthenticated visitor is sent to the login page", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()

  // The gate has to actually withhold the page, not merely change the URL:
  // the desk's own heading and its nav must both be absent.
  await expect(page.getByRole("heading", { name: "Charter desk" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Enquiries" })).toHaveCount(0)
})

test("every surface behind the gate is closed, not just the home page", async ({ page }) => {
  // Closed by default is the whole point, and it is the kind of thing that
  // regresses silently when a route is added — so this asserts it per route
  // rather than trusting the matcher to have been updated.
  for (const path of ["/enquiries", "/enquiries/new", "/bookings", "/operators"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login/)
  }
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
