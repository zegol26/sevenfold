# NEXUS SEVENFOLD Web

Next.js frontend and PostgreSQL business-data layer for the NEXUS SEVENFOLD Resource Management Workflow.

## Architecture

The target hybrid architecture is:

- Browser uses the Next.js app only.
- Next.js owns signed HTTP-only session cookies.
- PostgreSQL stores structured operational data through Prisma services.
- Apps Script owns private Google Drive binary upload/download/template operations.
- Google Sheets is a legacy import/export source, not the production database.
- The browser never receives database credentials or the Apps Script API secret.
- No Clerk and no Google service account are required for the frontend.

## PostgreSQL Setup

1. Copy `.env.local.example` to `.env.local`.
2. Run `docker compose up -d` for local PostgreSQL.
3. Set `DATABASE_URL="postgresql://nexus:nexus_local_only@localhost:5432/nexus_sevenfold"`.
4. Run `npm run db:generate`, `npm run db:push`, and `npm run db:seed`.
5. Run `npm run dev`.

For Neon/Vercel, set the pooled TLS `DATABASE_URL` in Vercel Environment Variables. The build script generates Prisma Client automatically.

## Legacy Sheet Import

Set `GOOGLE_SHEET_ID`, `GAS_WEB_APP_URL`, and `GAS_API_SECRET`. The importer reads private legacy tabs through the authenticated GAS bridge, so no Google API key is required. `GOOGLE_SHEETS_API_KEY` remains an optional fallback. Run:

```powershell
npm run import:sheets:dry
npm run import:sheets:run
```

The importer reports inserted, updated, skipped, and failed rows. It uses stable business keys and `legacySourceId`. The referenced Sheet returned HTTP 401 without Google credentials during implementation, so no live rows were imported.

## Legacy Excel Import

If the Google Sheets bridge is unavailable, export/download the database as `.xlsx` and import it directly:

```powershell
$env:EXCEL_IMPORT_PATH="C:\Users\user\Downloads\NEXUS_SEVENFOLD_DATABASE.xlsx"
npm run import:sheets:dry
npm run import:sheets:run
Remove-Item Env:EXCEL_IMPORT_PATH
```

The importer prefers `EXCEL_IMPORT_PATH` over GAS/Sheets. The 2026-07-10 migration imported the workbook into the isolated PostgreSQL schema `nexus_sevenfold` with 95 writes and 0 errors. Rows without required Drive file IDs are skipped instead of creating fake document metadata.

## GAS Document Repository

Copy `src/driveDocumentRepository.gs` and the updated `src/apiService.gs` from the repository root into Apps Script. Configure `GOOGLE_DRIVE_ROOT_FOLDER_ID` and `NEXUS_GAS_API_SECRET` as Script Properties, deploy a new Web App version, then run:

- `previewDriveConfig()`
- `previewDocumentSchema()`
- `testListTemplates()`
- `testUploadDummyDocument()` (optional, creates a test file)

The Drive layer supports `listDocuments`, `uploadDocument`, `downloadDocument`, `copyTemplate`, `archiveDocument`, and `getDocumentMetadata`.

## Required Environment Variables

```bash
NEXUS_GAS_WEB_APP_URL=https://script.google.com/macros/s/.../exec
NEXUS_GAS_API_SECRET=replace-with-the-same-secret-in-apps-script
NEXUS_SESSION_SECRET=replace-with-a-long-random-string
BCRYPT_SALT_ROUNDS=10
```

Set the same `NEXUS_GAS_API_SECRET` value in Apps Script:

```text
Project Settings -> Script Properties -> Add script property
Name: NEXUS_GAS_API_SECRET
Value: same value as web/.env.local
```

## Apps Script Files Required

Copy/deploy the updated backend bridge file to Apps Script:

- `src/apiService.gs`

The rest of the backend service files must already exist in Apps Script from the Drive/database/workflow setup. After copying `apiService.gs`, deploy a new Apps Script Web App version.

Run `setupDatabase()` if schema columns are missing, especially `password_hash` in `users`.

## First Super Admin Password

The existing Super Admin row needs a `password_hash` value before login works. Generate it locally:

```bash
npm run hash-password -- "YourStrongPassword"
```

Paste the generated hash into the Super Admin row's `password_hash` column. After login, use User Management to create/update users with temporary passwords.

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Routes

The app is implemented as one authenticated dashboard with production-friendly route aliases:

```text
/
/dashboard
/admin/users
/admin/candidates
/client/feedback
/resource/onboarding
/operations/documents
/operations/timesheets
/operations/overtime
/operations/leave
/finance/gr-invoices
/unauthorized
```

Aliases are handled by `src/proxy.ts` and map into dashboard sections. Backend RBAC still decides whether each action is allowed.

## Validation

From the repository root:

```bash
node scripts/validate-apps-script.js
cd web
npm run lint
npm run build
```

Current MVP coverage includes users, master client/project setup, candidates, client feedback, onboarding, resource commercial/contract terms, document metadata, timesheets, overtime, leave, GR records, and invoice drafts.

Resource commercial terms include editable remuneration, client bill rate, PPH21/PPH23, BPJS Kesehatan, BPJS TK, 15% default management fee, recruitment fee, net pay estimate, and invoice estimate. Deploy the matching Apps Script schema/API files and run `setupDatabase()` before using this in production.

## Production Notes

- Deploy Apps Script first, then set `NEXUS_GAS_WEB_APP_URL` to the `/exec` URL.
- Keep `NEXUS_GAS_API_SECRET` server-only. Do not create a `NEXT_PUBLIC_*` copy.
- Use User Management to create scoped users and temporary passwords.
- Create client/project master data before candidate intake so dropdowns are usable.
- Apps Script/Sheets latency is expected; for heavier usage, add caching or move structured data to a dedicated database.
