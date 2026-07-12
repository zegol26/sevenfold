import { test, expect, type Page } from "@playwright/test";

// UAT for the Create Opportunity -> Scenario -> Commodity Line -> Cashflow Option
// -> Approve path, plus the edit and detail-page affordances added on top of it.
//
// Uses a real, seeded Super Admin account (Super Admin bypasses the per-action role
// checks in src/app/actions.ts, so it can exercise every step below).
//
// History: the original (Phase 0) version of this spec used Radix Dialog-scoped
// locators, because Create Opportunity/Scenario/Cashflow Option used to open in a
// modal. That baseline run surfaced a real UX bug - the modal did not auto-close
// after a successful save - which motivated replacing those three flows with the
// non-modal inline panels this spec now drives (see InlineFormPanel in
// dashboard-client.tsx). Nothing here should ever need to reach for a dialog role
// again for these three flows.

function readTestCredential(primaryName: string, fallbackName: string) {
  const value = process.env[primaryName] || process.env[fallbackName];
  if (!value) {
    throw new Error(`${primaryName} (or ${fallbackName}) must be set before running Playwright.`);
  }
  return value;
}

const TEST_EMAIL = readTestCredential("PLAYWRIGHT_TEST_EMAIL", "SEVENFOLD_SUPER_ADMIN_EMAILS").split(",")[0].trim();
const TEST_PASSWORD = readTestCredential("PLAYWRIGHT_TEST_PASSWORD", "SEVENFOLD_SUPER_ADMIN_PASSWORD");

const RUN_ID = Date.now().toString(36).toUpperCase();
const OPPORTUNITY_ID = `E2E-OPP-${RUN_ID}`;
const SCENARIO_ID = `E2E-SCN-${RUN_ID}`;
const CASHFLOW_OPTION_ID = `E2E-CFO-${RUN_ID}`;

async function login(page: Page) {
  await page.goto("/");
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button:has-text("Sign in")');
  // "NEXUS SEVENFOLD" also appears as a brand label on the login page itself, so
  // assert on something that only exists once authenticated: the sidebar subtitle.
  await expect(page.getByText("Business & Project Management")).toBeVisible({ timeout: 15_000 });
}

/** Scopes to a specific InlineFormPanel by its title (via data-panel-title, set in
 * dashboard-client.tsx) rather than fragile text-based DOM traversal. */
function inlinePanel(page: Page, title: string) {
  return page.locator(`[data-testid="inline-form-panel"][data-panel-title="${title}"]`);
}

async function openInlinePanel(page: Page, title: string, triggerName: "Create" | "Add") {
  const panel = inlinePanel(page, title);
  await panel.getByRole("button", { name: triggerName, exact: true }).click();
  return panel;
}

async function selectCombobox(panel: ReturnType<typeof inlinePanel>, nth: number, optionNamePattern: string | RegExp) {
  await panel.locator('button[role="combobox"]').nth(nth).click();
  await panel.page().getByRole("option", { name: optionNamePattern }).click();
}

test.describe("Opportunity -> Cashflow Analysis", () => {
  test("create, edit, drill into detail, and approve across the full flow", async ({ page }) => {
    await login(page);

    // --- Opportunity Analysis: Create Opportunity ---
    await page.click('button:has-text("Opportunity Analysis")');
    await expect(page.getByRole("heading", { name: "Opportunity Analysis" })).toBeVisible();

    let panel = await openInlinePanel(page, "Create Opportunity ID", "Create");
    await panel.locator('input[name="opportunity_id"]').fill(OPPORTUNITY_ID);
    await panel.locator('input[name="customer_name"]').fill("Playwright QA Customer");
    await panel.locator('input[name="owner"]').fill(TEST_EMAIL);
    await selectCombobox(panel, 0, "Small");
    // The second visible combobox is the opportunity status selector. Pick an
    // allowed cashflow-eligible status so the flow can proceed end to end.
    await selectCombobox(panel, 1, /^approved$/);
    await panel.locator('textarea[name="scope_summary"]').fill("Playwright E2E scope summary.");
    await panel.getByRole("button", { name: "Create Opportunity" }).click();
    await page.waitForTimeout(500);

    // The panel must stay open/in-flow after submit (no auto-dismiss, no overlay) -
    // this is the whole point of the inline-panel redesign, unlike the old modal.
    await expect(panel.locator('input[name="customer_name"]')).toBeVisible();
    await expect(page.getByText(OPPORTUNITY_ID)).toBeVisible({ timeout: 10_000 });
    await panel.getByRole("button", { name: "Close", exact: true }).click();

    // --- Edit the opportunity inline from the list row ---
    const editedCustomerName = `Playwright QA Customer (edited ${RUN_ID})`;
    const opportunityRow = page.locator("tr", { hasText: OPPORTUNITY_ID });
    await opportunityRow.getByRole("button", { name: "Edit", exact: true }).click();
    const editRow = page.locator("tr").filter({ has: page.locator('input[name="customer_name"]') }).last();
    await editRow.locator('input[name="customer_name"]').fill(editedCustomerName);
    await editRow.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForTimeout(500);
    await expect(opportunityRow.getByText(editedCustomerName)).toBeVisible({ timeout: 10_000 });
    await opportunityRow.getByRole("button", { name: "Close", exact: true }).click();

    // --- Scenario ---
    await page.click('[role="tab"]:has-text("Scenarios")');
    panel = await openInlinePanel(page, "Create Proposal Scenario", "Create");
    await selectCombobox(panel, 0, new RegExp(OPPORTUNITY_ID));
    await panel.locator('input[name="scenario_id"]').fill(SCENARIO_ID);
    await panel.locator('input[name="scenario_name"]').fill("Playwright QA Scenario");
    await panel.getByRole("button", { name: "Create Scenario" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(SCENARIO_ID)).toBeVisible({ timeout: 10_000 });

    // --- Commodity Cost Line (still the original Dialog flow - Commodity/Risk/Pricing
    // stayed create-only and out of scope for the inline-panel conversion) ---
    await page.click('[role="tab"]:has-text("Commodity Cost")');
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const commodityDialog = page.getByRole("dialog");
    await expect(commodityDialog).toBeVisible();
    await selectCombobox(commodityDialog, 0, new RegExp(OPPORTUNITY_ID));
    await commodityDialog.locator('input[name="scenario_id"]').fill(SCENARIO_ID);
    await selectCombobox(commodityDialog, 1, /^Services$/);
    await commodityDialog.locator('input[name="unit_cost"]').fill("1000");
    await commodityDialog.locator('input[name="unit_price"]').fill("1500");
    await commodityDialog.getByRole("button", { name: "Add Cost Line" }).click();
    await page.waitForTimeout(500);
    // Known UX gap (documented in Phase 0): this Dialog does not auto-close on save.
    const cancelButton = commodityDialog.getByRole("button", { name: "Cancel" });
    if (await cancelButton.isVisible().catch(() => false)) await cancelButton.click();
    await page.waitForTimeout(500);
    await expect(page.getByText(SCENARIO_ID).first()).toBeVisible({ timeout: 10_000 });

    // --- Cashflow Analysis ---
    await page.click('button:has-text("Cashflow Analysis")');
    await expect(page.getByRole("heading", { name: "Cashflow Analysis" })).toBeVisible();

    panel = await openInlinePanel(page, "Create Cashflow Option", "Create");
    await selectCombobox(panel, 0, new RegExp(OPPORTUNITY_ID));
    await panel.locator('input[name="option_id"]').fill(CASHFLOW_OPTION_ID);
    await panel.locator('input[name="option_name"]').fill("Playwright QA Cashflow Option");
    await panel.locator('input[name="invoice_date"]').fill("2026-08-01");
    await panel.locator('input[name="gross_invoice"]').fill("150000");
    await panel.locator('input[name="cost_timing_amount"]').fill("100000");
    await panel.getByRole("button", { name: "Create Cashflow Option" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(CASHFLOW_OPTION_ID)).toBeVisible({ timeout: 10_000 });

    // --- Edit the cashflow option before approving ---
    const cashflowRow = page.locator("tr", { hasText: CASHFLOW_OPTION_ID });
    await cashflowRow.getByRole("button", { name: "Edit", exact: true }).click();
    const cashflowEditRow = page.locator("tr").filter({ has: page.locator('input[name="option_name"]') }).last();
    await cashflowEditRow.locator('input[name="gross_invoice"]').fill("160000");
    await cashflowEditRow.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("tr", { hasText: CASHFLOW_OPTION_ID })).toContainText("160,000");
    await cashflowRow.getByRole("button", { name: "Close", exact: true }).click();

    // --- Approve the cashflow option, then confirm editing locks ---
    const approveRow = page.locator("tr", { hasText: CASHFLOW_OPTION_ID });
    await approveRow.getByRole("button", { name: "Approve" }).click();
    await page.waitForTimeout(500);
    await expect(approveRow.getByText(/approved/i)).toBeVisible({ timeout: 10_000 });
    await expect(approveRow.getByRole("button", { name: "Edit", exact: true })).toBeDisabled();

    // --- Click through to the Opportunity Object Page ---
    await page.click('button:has-text("Opportunity Analysis")');
    await page.waitForTimeout(300);
    const link = page.locator(`a[href*="${encodeURIComponent(OPPORTUNITY_ID)}"]`).first();
    const href = await link.getAttribute("href");
    expect(href).toContain("opportunityId=");
    await link.click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Back to Opportunities")).toBeVisible();
    // Scenario/cashflow codes legitimately repeat across the header + section
    // tables on this page, so assert presence rather than a unique match.
    await expect(page.getByText(SCENARIO_ID).first()).toBeVisible();
    await expect(page.getByText(CASHFLOW_OPTION_ID).first()).toBeVisible();
  });
});
