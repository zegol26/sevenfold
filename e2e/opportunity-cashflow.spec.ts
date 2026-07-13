import { test, expect, type Page } from "@playwright/test";

// UAT for the full guarded opportunity lifecycle:
// Create (Draft) -> Scenario -> Commodity Line -> Pricing Decision ->
// Submit for Review -> Approve Pricing Structure -> Release to Cashflow ->
// Cashflow Option -> Approve -> Final Opportunity Approval -> detail page checks.
//
// Uses a real, seeded Super Admin account (Super Admin bypasses the per-action role
// checks in src/app/actions.ts, so it can exercise every step below).
//
// History:
// - Phase 0 surfaced the modal-doesn't-auto-close bug; the create flows moved to
//   inline panels (InlineFormPanel) and dialogs now auto-close on success via
//   ActionForm (src/components/ui/action-form.tsx).
// - The enterprise-workflow pass removed the direct status dropdown: status now only
//   changes through explicit workflow actions on the opportunity detail page, which
//   this spec drives end to end (business plan §6.1).

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
  test("create, analyze, run workflow transitions, and approve across the full flow", async ({ page }) => {
    // Workflow actions with business consequences ask for confirmation via a native
    // confirm() — accept them all in this happy-path spec.
    page.on("dialog", (dialog) => dialog.accept());

    await login(page);

    // --- Opportunity Analysis: Create Opportunity (always starts in Draft) ---
    await page.click('button:has-text("Opportunity Analysis")');
    await expect(page.getByRole("heading", { name: "Opportunity Analysis" })).toBeVisible();

    let panel = await openInlinePanel(page, "Create Opportunity", "Create");
    await panel.locator('input[name="opportunity_id"]').fill(OPPORTUNITY_ID);
    await panel.locator('input[name="customer_name"]').fill("Playwright QA Customer");
    await panel.locator('input[name="owner"]').fill(TEST_EMAIL);
    await selectCombobox(panel, 0, "Small");
    await panel.locator('textarea[name="scope_summary"]').fill("Playwright E2E scope summary.");
    await panel.getByRole("button", { name: "Create Opportunity" }).click();
    await page.waitForTimeout(500);

    // The panel stays in-flow after submit (no auto-dismiss, no overlay).
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

    // --- Commodity Cost Line (Dialog flow; auto-closes on successful save) ---
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
    // Successful dialog submissions now close the dialog automatically.
    await expect(commodityDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(SCENARIO_ID).first()).toBeVisible({ timeout: 10_000 });

    // --- Pricing Structure Decision (approved) — entry criterion for the
    // "Approve Pricing Structure" workflow action ---
    await page.click('[role="tab"]:has-text("Pricing Decision")');
    await page.getByRole("button", { name: "Open", exact: true }).click();
    const pricingDialog = page.getByRole("dialog");
    await expect(pricingDialog).toBeVisible();
    await selectCombobox(pricingDialog, 0, new RegExp(OPPORTUNITY_ID));
    await pricingDialog.locator('input[name="scenario_id"]').fill(SCENARIO_ID);
    await pricingDialog.locator('input[name="decision"]').fill(`SELECT_${SCENARIO_ID}`);
    await selectCombobox(pricingDialog, 1, /^Approved$/);
    await selectCombobox(pricingDialog, 2, /Mark as commercial scenario/);
    await pricingDialog.getByRole("button", { name: "Save Pricing Decision" }).click();
    await expect(pricingDialog).not.toBeVisible({ timeout: 10_000 });

    // --- Drive the explicit lifecycle on the opportunity detail page ---
    await page.click('[role="tab"]:has-text("Opportunities")');
    const detailLink = page.locator(`a[href*="${encodeURIComponent(OPPORTUNITY_ID)}"]`).first();
    await detailLink.click();
    await expect(page.getByText("Back to Opportunities")).toBeVisible({ timeout: 10_000 });

    for (const action of ["Submit for Review", "Approve Pricing Structure", "Release to Cashflow Analysis"]) {
      await page.getByRole("button", { name: action, exact: true }).click();
      await page.waitForTimeout(800);
    }
    await expect(page.getByText("Ready for Cashflow").first()).toBeVisible({ timeout: 10_000 });

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

    // --- Approve the cashflow option (confirmation auto-accepted), then confirm lock ---
    const approveRow = page.locator("tr", { hasText: CASHFLOW_OPTION_ID });
    await approveRow.getByRole("button", { name: "Approve" }).click();
    await page.waitForTimeout(500);
    await expect(approveRow.getByText(/approved/i)).toBeVisible({ timeout: 10_000 });
    await expect(approveRow.getByRole("button", { name: "Edit", exact: true })).toBeDisabled();

    // --- Final opportunity approval + detail page information architecture ---
    await page.click('button:has-text("Opportunity Analysis")');
    await page.waitForTimeout(300);
    const link = page.locator(`a[href*="${encodeURIComponent(OPPORTUNITY_ID)}"]`).first();
    const href = await link.getAttribute("href");
    expect(href).toContain("opportunityId=");
    await link.click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Back to Opportunities")).toBeVisible();

    await page.getByRole("button", { name: "Approve Opportunity", exact: true }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/Commercially approved/).first()).toBeVisible({ timeout: 10_000 });

    // Detail tabs: commercial + cashflow content is present and currency-labelled.
    await expect(page.getByText(SCENARIO_ID).first()).toBeVisible();
    await page.getByRole("tab", { name: /Cashflow/ }).click();
    await expect(page.getByText(CASHFLOW_OPTION_ID).first()).toBeVisible();
    await expect(page.getByText(/\$160,000|\$\s160,000/).first()).toBeVisible();
  });
});
