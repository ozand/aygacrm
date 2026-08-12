import { expect, test } from "@playwright/test";

test.setTimeout(90000);

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = uniqueEmail();
  const password = "password123";

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Sign in to your account")).toBeVisible();
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Create your account")).toBeVisible();
  // Cold-start guard: wait for hydration so fills aren't wiped by React mount
  await page.waitForLoadState("networkidle");

  await page.locator("#firstName").fill("E2E");
  await expect(page.locator("#firstName")).toHaveValue("E2E");
  await page.locator("#lastName").fill("User");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL(/\/login\?registered=true$/);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL(/\/dashboard$/);
}

test("user can navigate, create contact, and find it via global search", async ({ page }) => {
  const contactName = `Playwright ${Date.now()}`;
  const contactEmail = `contact-${Date.now()}@example.com`;

  await registerAndLogin(page);

  await expect(page.getByRole("button", { name: "Search... Ctrl K" })).toBeVisible();
  await page.goto("/contacts");
  await expect(page.getByRole("heading", { name: "Contacts", exact: true })).toBeVisible();

  await page.goto("/contacts/new");
  await expect(page.getByText("Add Contact")).toBeVisible();
  await page.getByLabel("First Name").fill(contactName);
  await page.getByLabel("Email").fill(contactEmail);
  await page.getByRole("button", { name: "Create Contact" }).click();

  // Creation lands on the new contact's detail page
  await page.waitForURL(/\/contacts\/[^/]+$/);
  await expect(page.getByText(contactName).first()).toBeVisible();

  await page.getByRole("button", { name: "Search... Ctrl K" }).click();
  await page.getByPlaceholder("Search contacts, notes, tasks, records...").fill(contactName);
  const searchResult = page.getByRole("button", { name: new RegExp(contactName, "i") });
  await expect(searchResult).toBeVisible();
  await searchResult.click();

  await page.waitForURL(/\/contacts\/[^/]+$/);
  await expect(page.getByText(contactEmail).first()).toBeVisible();
});
