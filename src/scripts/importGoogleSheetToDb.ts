import { PrismaClient, ResourceKind, UserStatus } from "@prisma/client";
import * as XLSX from "xlsx";

type Row = Record<string, string>;
type Stats = { inserted: number; updated: number; skipped: number; errors: number };

const prisma = new PrismaClient();
const sheetId = process.env.GOOGLE_SHEET_ID;
const excelImportPath = process.env.EXCEL_IMPORT_PATH;
const dryRun = process.env.DRY_RUN !== "false";
const stats: Stats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };

const tabs = [
  "roles", "clients", "projects", "candidates", "employees", "users",
  "assignments", "project_applications", "candidate_documents", "employee_documents",
  "invoices", "invoice_lines", "audit_logs", "system_settings",
] as const;

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function csvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && csv[i + 1] === "\n") i += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function cellToString(value: unknown) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function readExcelTab(tab: string): Row[] {
  if (!excelImportPath) return [];
  const workbook = XLSX.readFile(excelImportPath, { cellDates: true });
  const sheet = workbook.Sheets[tab];
  if (!sheet) return [];
  const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (values.length < 2) return [];
  const headers = values[0].map((value) => normalizeKey(cellToString(value)));
  return values.slice(1)
    .filter((valuesRow) => valuesRow.some((value) => cellToString(value) !== ""))
    .map((valuesRow) => Object.fromEntries(headers.map((header, index) => [header, cellToString(valuesRow[index])])));
}

async function readTab(tab: string): Promise<Row[]> {
  if (excelImportPath) return readExcelTab(tab);
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is required");
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const gasUrl = process.env.GAS_WEB_APP_URL || process.env.NEXUS_GAS_WEB_APP_URL;
  const gasSecret = process.env.GAS_API_SECRET || process.env.NEXUS_GAS_API_SECRET;

  if (!apiKey && gasUrl && gasSecret) {
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        secret: gasSecret,
        action: "exportLegacySheetTab",
        payload: { sheetName: tab },
      }),
    });
    const body = await response.json() as {
      ok: boolean;
      data?: Row[];
      error?: string | { message?: string };
    };
    if (!response.ok || !body.ok) {
      const message = typeof body.error === "string" ? body.error : body.error?.message;
      throw new Error(`${tab}: ${message || `GAS returned HTTP ${response.status}`}`);
    }
    return body.data || [];
  }

  const url = apiKey
    ? `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}?key=${apiKey}`
    : `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${tab}: Google Sheets returned HTTP ${response.status}`);
  let values: string[][];
  if (apiKey) {
    const body = await response.json() as { values?: string[][] };
    values = body.values || [];
  } else values = csvRows(await response.text());
  if (values.length < 2) return [];
  const headers = values[0].map(normalizeKey);
  return values.slice(1)
    .filter((valuesRow) => valuesRow.some(Boolean))
    .map((valuesRow) => Object.fromEntries(headers.map((header, index) => [header, valuesRow[index] || ""])));
}

function date(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function money(value?: string) {
  const parsed = Number(String(value || "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalMoney(value?: string) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return money(value);
}

function optionalInt(value?: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonValue(value?: string) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function apply(label: string, legacySourceId: string, exists: boolean, operation: () => Promise<unknown>) {
  if (!legacySourceId) { stats.skipped += 1; return; }
  if (dryRun) {
    stats[exists ? "updated" : "inserted"] += 1;
    return;
  }
  try {
    await operation();
    stats[exists ? "updated" : "inserted"] += 1;
  } catch (error) {
    stats.errors += 1;
    console.error(`${label} ${legacySourceId}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function importRoles(rows: Row[]) {
  for (const row of rows) {
    const legacySourceId = row.role_id;
    const existing = await prisma.role.findFirst({ where: { OR: [{ legacySourceId }, { code: legacySourceId }] } });
    await apply("role", legacySourceId, Boolean(existing), () => prisma.role.upsert({
      where: { code: legacySourceId },
      update: { name: row.role_name, description: row.description, permissions: row.permissions.split(",").filter(Boolean), status: row.status || "active", legacySourceId },
      create: { code: legacySourceId, name: row.role_name, description: row.description, permissions: row.permissions.split(",").filter(Boolean), status: row.status || "active", legacySourceId },
    }));
  }
}

async function importClients(rows: Row[]) {
  for (const row of rows) {
    const legacySourceId = row.client_id;
    const code = row.client_code || legacySourceId;
    const existing = await prisma.client.findFirst({ where: { OR: [{ legacySourceId }, { code }] } });
    await apply("client", legacySourceId, Boolean(existing), () => prisma.client.upsert({
      where: { code },
      update: { name: row.client_name, status: row.status || "active", legacySourceId },
      create: { code, name: row.client_name, status: row.status || "active", legacySourceId },
    }));
    if (!dryRun && (row.primary_contact_name || row.primary_contact_email)) {
      const client = await prisma.client.findUnique({ where: { code } });
      if (client) {
        await prisma.clientContact.upsert({
          where: { id: `${legacySourceId}:primary` },
          update: {
            clientId: client.id,
            name: row.primary_contact_name || "Primary Contact",
            email: row.primary_contact_email || null,
            isPrimary: true,
            status: "active",
          },
          create: {
            id: `${legacySourceId}:primary`,
            clientId: client.id,
            name: row.primary_contact_name || "Primary Contact",
            email: row.primary_contact_email || null,
            isPrimary: true,
            status: "active",
          },
        });
      }
    }
  }
}

async function importProjects(rows: Row[]) {
  for (const row of rows) {
    const client = await prisma.client.findFirst({ where: { OR: [{ legacySourceId: row.client_id }, { code: row.client_id }] } });
    if (!client) { stats.skipped += 1; continue; }
    const legacySourceId = row.project_id;
    const existing = await prisma.project.findUnique({ where: { legacySourceId } });
    await apply("project", legacySourceId, Boolean(existing), () => prisma.project.upsert({
      where: { legacySourceId },
      update: { name: row.project_name, code: row.project_code || legacySourceId, clientId: client.id, startDate: date(row.start_date), endDate: date(row.end_date), status: row.status || "active" },
      create: { legacySourceId, name: row.project_name, code: row.project_code || legacySourceId, clientId: client.id, startDate: date(row.start_date), endDate: date(row.end_date), status: row.status || "active" },
    }));
  }
}

async function importResources(rows: Row[], kind: ResourceKind) {
  for (const row of rows) {
    const legacySourceId = kind === "CANDIDATE" ? row.candidate_id : row.employee_id;
    const existing = await prisma.resource.findUnique({ where: { legacySourceId } });
    const resourceData = {
      kind,
      fullName: row.full_name,
      email: row.email || null,
      phone: row.phone || null,
      position: row.position_applied || null,
      candidateStage: row.interview_status || null,
      employmentType: row.employment_type || null,
      joinDate: date(row.join_date),
      endDate: date(row.end_date),
      assignedClientLegacyId: row.assigned_client_id || row.client_id || null,
      assignedProjectLegacyId: row.assigned_project_id || row.project_id || null,
      contractStatus: row.contract_status || null,
      driveFolderId: row.drive_folder_id || null,
      ndaAcknowledgedAt: date(row.nda_acknowledged_at),
      codeOfEthicsAcknowledgedAt: date(row.code_of_ethics_acknowledged_at),
      dataPrivacyConsentAcknowledgedAt: date(row.data_privacy_consent_acknowledged_at),
      onboardingTrainingCompletedAt: date(row.onboarding_training_completed_at),
      resourceReadyAt: date(row.resource_ready_at),
      contractType: row.contract_type || null,
      contractNumber: row.contract_number || null,
      contractStartDate: date(row.contract_start_date),
      contractEndDate: date(row.contract_end_date),
      baseSalary: optionalMoney(row.base_salary),
      allowanceAmount: optionalMoney(row.allowance_amount),
      grossMonthlySalary: optionalMoney(row.gross_monthly_salary),
      dailyRate: optionalMoney(row.daily_rate),
      hourlyRate: optionalMoney(row.hourly_rate),
      clientBillRate: optionalMoney(row.client_bill_rate),
      managementFeeRate: optionalMoney(row.management_fee_rate),
      managementFeeAmount: optionalMoney(row.management_fee_amount),
      recruitmentFee: optionalMoney(row.recruitment_fee),
      taxType: row.tax_type || null,
      taxRate: optionalMoney(row.tax_rate),
      pph21Amount: optionalMoney(row.pph21_amount),
      pph23Amount: optionalMoney(row.pph23_amount),
      bpjsKesehatanRate: optionalMoney(row.bpjs_kesehatan_rate),
      bpjsKesehatanAmount: optionalMoney(row.bpjs_kesehatan_amount),
      bpjsTkRate: optionalMoney(row.bpjs_tk_rate),
      bpjsTkAmount: optionalMoney(row.bpjs_tk_amount),
      netPayEstimate: optionalMoney(row.net_pay_estimate),
      invoiceAmountEstimate: optionalMoney(row.invoice_amount_estimate),
      commercialNotes: row.commercial_notes || null,
      status: row.status || "active",
    };
    await apply("resource", legacySourceId, Boolean(existing), () => prisma.resource.upsert({
      where: { legacySourceId },
      update: resourceData,
      create: { legacySourceId, ...resourceData },
    }));
  }
}

async function importUsers(rows: Row[]) {
  for (const row of rows) {
    const role = await prisma.role.findFirst({ where: { OR: [{ legacySourceId: row.role_id }, { code: row.role_id }] } });
    if (!role || !row.email) { stats.skipped += 1; continue; }
    const client = row.client_id ? await prisma.client.findUnique({ where: { legacySourceId: row.client_id } }) : null;
    const resource = row.employee_id ? await prisma.resource.findUnique({ where: { legacySourceId: row.employee_id } }) : null;
    const email = row.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    await apply("user", row.user_id, Boolean(existing), () => prisma.user.upsert({
      where: { email },
      update: { fullName: row.full_name, passwordHash: row.password_hash || null, roleId: role.id, clientId: client?.id, resourceId: resource?.id, status: row.status === "active" ? UserStatus.ACTIVE : UserStatus.INACTIVE, legacySourceId: row.user_id },
      create: { email, fullName: row.full_name, passwordHash: row.password_hash || null, roleId: role.id, clientId: client?.id, resourceId: resource?.id, status: row.status === "active" ? UserStatus.ACTIVE : UserStatus.INACTIVE, legacySourceId: row.user_id },
    }));
  }
}

async function importInvoices(rows: Row[]) {
  for (const row of rows) {
    const client = await prisma.client.findUnique({ where: { legacySourceId: row.client_id } });
    if (!client) { stats.skipped += 1; continue; }
    const project = row.project_id ? await prisma.project.findUnique({ where: { legacySourceId: row.project_id } }) : null;
    const legacySourceId = row.invoice_id;
    const invoiceNumber = row.invoice_number || legacySourceId;
    const existing = await prisma.invoice.findFirst({ where: { OR: [{ legacySourceId }, { invoiceNumber }] } });
    await apply("invoice", legacySourceId, Boolean(existing), () => prisma.invoice.upsert({
      where: { invoiceNumber },
      update: { clientId: client.id, projectId: project?.id, currency: row.currency || "IDR", invoiceDate: date(row.invoice_date), dueDate: date(row.due_date), subtotal: money(row.subtotal), taxAmount: money(row.tax_amount), managementFeeAmount: money(row.management_fee_amount), recruitmentFeeAmount: money(row.recruitment_fee), totalAmount: money(row.total_amount), legacySourceId },
      create: { invoiceNumber, clientId: client.id, projectId: project?.id, currency: row.currency || "IDR", invoiceDate: date(row.invoice_date), dueDate: date(row.due_date), subtotal: money(row.subtotal), taxAmount: money(row.tax_amount), managementFeeAmount: money(row.management_fee_amount), recruitmentFeeAmount: money(row.recruitment_fee), totalAmount: money(row.total_amount), legacySourceId },
    }));
  }
}

async function importAssignments(rows: Row[]) {
  for (const row of rows) {
    const resource = await prisma.resource.findUnique({ where: { legacySourceId: row.employee_id } });
    const client = await prisma.client.findUnique({ where: { legacySourceId: row.client_id } });
    const project = await prisma.project.findUnique({ where: { legacySourceId: row.project_id } });
    if (!resource || !client || !project) { stats.skipped += 1; continue; }
    const legacySourceId = row.assignment_id;
    const existing = await prisma.assignment.findUnique({ where: { legacySourceId } });
    await apply("assignment", legacySourceId, Boolean(existing), () => prisma.assignment.upsert({
      where: { legacySourceId },
      update: { resourceId: resource.id, clientId: client.id, projectId: project.id, roleTitle: row.role_title || null, startDate: date(row.start_date), endDate: date(row.end_date), status: row.status || "active" },
      create: { legacySourceId, resourceId: resource.id, clientId: client.id, projectId: project.id, roleTitle: row.role_title || null, startDate: date(row.start_date), endDate: date(row.end_date), status: row.status || "active" },
    }));
  }
}

async function importInvoiceLines(rows: Row[]) {
  for (const row of rows) {
    const invoice = await prisma.invoice.findUnique({ where: { legacySourceId: row.invoice_id } });
    if (!invoice || !row.invoice_line_id) { stats.skipped += 1; continue; }
    const existing = await prisma.invoiceItem.findUnique({ where: { id: row.invoice_line_id } });
    await apply("invoice_line", row.invoice_line_id, Boolean(existing), () => prisma.invoiceItem.upsert({
      where: { id: row.invoice_line_id },
      update: { invoiceId: invoice.id, description: row.description, quantity: money(row.quantity), unitPrice: money(row.unit_price), taxRate: money(row.tax_rate), lineTotal: money(row.line_total) },
      create: { id: row.invoice_line_id, invoiceId: invoice.id, description: row.description, quantity: money(row.quantity), unitPrice: money(row.unit_price), taxRate: money(row.tax_rate), lineTotal: money(row.line_total) },
    }));
  }
}

async function importProjectApplications(rows: Row[]) {
  for (const row of rows) {
    const resource = await prisma.resource.findUnique({ where: { legacySourceId: row.employee_id } });
    const project = await prisma.project.findUnique({ where: { legacySourceId: row.project_id } });
    if (!resource || !project || !row.application_id) { stats.skipped += 1; continue; }
    const existing = await prisma.projectApplication.findUnique({ where: { legacySourceId: row.application_id } });
    await apply("project_application", row.application_id, Boolean(existing), () => prisma.projectApplication.upsert({
      where: { legacySourceId: row.application_id },
      update: {
        resourceId: resource.id,
        projectId: project.id,
        roleInterest: row.role_interest || null,
        availabilityDate: date(row.availability_date),
        notes: row.notes || null,
        status: row.review_status || row.status || "submitted",
      },
      create: {
        legacySourceId: row.application_id,
        resourceId: resource.id,
        projectId: project.id,
        roleInterest: row.role_interest || null,
        availabilityDate: date(row.availability_date),
        notes: row.notes || null,
        status: row.review_status || row.status || "submitted",
      },
    }));
  }
}

async function importDocuments(rows: Row[], defaultEntityType: string) {
  for (const row of rows) {
    const driveFileId = row.drive_file_id;
    const legacySourceId = row.document_id;
    if (!driveFileId || !legacySourceId) { stats.skipped += 1; continue; }
    const entityType = row.entity_type || defaultEntityType;
    const entityId = row.entity_id || row.employee_id || row.candidate_id;
    const existing = await prisma.document.findFirst({ where: { OR: [{ driveFileId }, { legacySourceId }] } });
    await apply("document", legacySourceId, Boolean(existing), () => prisma.document.upsert({
      where: { driveFileId },
      update: {
        fileName: row.file_name || legacySourceId,
        mimeType: "application/octet-stream",
        documentType: row.document_type || "document",
        entityType,
        entityId,
        folderPath: row.drive_folder_id || null,
        version: optionalInt(row.version) || 1,
        status: row.status || "active",
        createdBy: row.created_by || row.uploaded_by || null,
        updatedBy: row.updated_by || null,
        legacySourceId,
      },
      create: {
        driveFileId,
        fileName: row.file_name || legacySourceId,
        mimeType: "application/octet-stream",
        documentType: row.document_type || "document",
        entityType,
        entityId,
        folderPath: row.drive_folder_id || null,
        version: optionalInt(row.version) || 1,
        status: row.status || "active",
        createdBy: row.created_by || row.uploaded_by || null,
        updatedBy: row.updated_by || null,
        legacySourceId,
      },
    }));
  }
}

async function importAuditLogs(rows: Row[]) {
  for (const row of rows) {
    if (!row.audit_id) { stats.skipped += 1; continue; }
    const actor = row.actor_user_id ? await prisma.user.findUnique({ where: { legacySourceId: row.actor_user_id } }) : null;
    const existing = await prisma.auditLog.findUnique({ where: { id: row.audit_id } });
    await apply("audit_log", row.audit_id, Boolean(existing), () => prisma.auditLog.upsert({
      where: { id: row.audit_id },
      update: {
        actorId: actor?.id || null,
        action: row.action || "LEGACY_IMPORT",
        entityType: row.entity_type || "legacy",
        entityId: row.entity_id || null,
        before: jsonValue(row.before_json),
        after: jsonValue(row.after_json),
        metadata: { notes: row.notes || "", ipAddress: row.ip_address || "", userAgent: row.user_agent || "" },
      },
      create: {
        id: row.audit_id,
        actorId: actor?.id || null,
        action: row.action || "LEGACY_IMPORT",
        entityType: row.entity_type || "legacy",
        entityId: row.entity_id || null,
        before: jsonValue(row.before_json),
        after: jsonValue(row.after_json),
        metadata: { notes: row.notes || "", ipAddress: row.ip_address || "", userAgent: row.user_agent || "" },
      },
    }));
  }
}

async function importSystemSettings(rows: Row[]) {
  for (const row of rows) {
    if (!row.setting_key) { stats.skipped += 1; continue; }
    const existing = await prisma.systemSetting.findUnique({ where: { key: row.setting_key } });
    await apply("system_setting", row.setting_id, Boolean(existing), () => prisma.systemSetting.upsert({
      where: { key: row.setting_key },
      update: { value: row.setting_value, description: row.description || null, status: row.status || "active", legacySourceId: row.setting_id },
      create: { key: row.setting_key, value: row.setting_value, description: row.description || null, status: row.status || "active", legacySourceId: row.setting_id },
    }));
  }
}

async function main() {
  console.log(`${excelImportPath ? "Legacy Excel" : "Legacy Sheet"} import: ${dryRun ? "DRY RUN" : "WRITE"}`);
  if (excelImportPath) console.log(`Source workbook: ${excelImportPath}`);
  for (const tab of tabs) {
    try {
      const rows = await readTab(tab);
      console.log(`${tab}: ${rows.length} rows`);
      if (tab === "roles") await importRoles(rows);
      else if (tab === "clients") await importClients(rows);
      else if (tab === "projects") await importProjects(rows);
      else if (tab === "candidates") await importResources(rows, ResourceKind.CANDIDATE);
      else if (tab === "employees") await importResources(rows, ResourceKind.EMPLOYEE);
      else if (tab === "users") await importUsers(rows);
      else if (tab === "assignments") await importAssignments(rows);
      else if (tab === "project_applications") await importProjectApplications(rows);
      else if (tab === "candidate_documents") await importDocuments(rows, "CANDIDATE");
      else if (tab === "employee_documents") await importDocuments(rows, "EMPLOYEE");
      else if (tab === "invoices") await importInvoices(rows);
      else if (tab === "invoice_lines") await importInvoiceLines(rows);
      else if (tab === "audit_logs") await importAuditLogs(rows);
      else if (tab === "system_settings") await importSystemSettings(rows);
    } catch (error) {
      stats.errors += 1;
      console.error(error instanceof Error ? error.message : `Failed to import ${tab}`);
    }
  }
  console.log(JSON.stringify(stats));
  if (stats.errors && !dryRun) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
