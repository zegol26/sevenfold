# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

This is the Next.js frontend and PostgreSQL business-data layer for **NEXUS SEVENFOLD**, a resource-management workflow system (candidate intake → client feedback → employment onboarding → timesheets/overtime/leave → GR/invoicing) for a staffing/outsourcing business. This `web/` app is the active MVP surface — the legacy GAS HTML frontend one level up (`../src/*.html`) is no longer the preferred deployment path.

The target architecture:

- Browser talks to Next.js only.
- Next.js owns signed HTTP-only session cookies (no Clerk, no client-side Google credentials).
- PostgreSQL (Prisma, Neon in production) stores structured operational data.
- Google Apps Script (source in `../src/*.gs`, one level up at the repo root) owns private Google Drive binary upload/download/template operations, and remains the source of truth for role checks, client scope, audit logging, workflow validation, and sensitive-field masking.
- Google Sheets is a legacy import/export source only, not the production database.

## Commands

Run from this directory (`web/`).

```powershell
npm run dev                 # next dev
npm run build                # prisma generate + next build
npm run lint                 # eslint
npx tsc --noEmit             # typecheck
npm run db:validate          # prisma validate
npm run db:generate          # prisma generate
npm run db:migrate           # prisma migrate dev
npm run db:push              # prisma db push
npm run db:seed              # tsx prisma/seed.ts
npm run hash-password -- "YourStrongPassword"   # generate a password_hash for a user row
```

Full local validation pass before considering a change done (matches `TEST_REPORT.md`):

```powershell
npx tsc --noEmit
npm run db:validate
npm run lint
npm run build
```

There is no JS unit test runner configured (no Jest/Vitest) in this repo yet.

GAS/root-repo commands proxied from here:

```powershell
npm run gas:validate    # -> npm --prefix .. run validate (validates ../src/*.gs)
npm run gas:push        # -> npm --prefix .. run clasp:push
```

Excel-based DB import (bypasses Sheets/GAS):

```powershell
$env:EXCEL_IMPORT_PATH="C:\path\to\NEXUS_SEVENFOLD_DATABASE.xlsx"
npm run import:sheets:dry
npm run import:sheets:run
Remove-Item Env:EXCEL_IMPORT_PATH
```

The Sheets/GAS-backed variant (no `EXCEL_IMPORT_PATH` set) reads via the authenticated GAS bridge using `GOOGLE_SHEET_ID`, `GAS_WEB_APP_URL`, `GAS_API_SECRET`. The importer matches rows by stable business keys plus `legacySourceId`, reports inserted/updated/skipped/failed counts, and skips rows missing required Drive file IDs rather than fabricating document metadata.

**Windows gotcha:** `npm run db:generate` can fail because a running `next dev` process locks Prisma's `query_engine-windows.dll.node`. Stop the dev server first, then regenerate.

## Architecture

### Trust boundary

Next.js is the only thing that talks to Apps Script, through the server-only bridge `src/lib/gas-client.ts`, authenticated with a shared secret (`NEXUS_GAS_API_SECRET`) that must never reach the browser — never give it a `NEXT_PUBLIC_` prefix. Frontend route/sidebar visibility (`src/proxy.ts`) is UX convenience only, not enforcement; every mutation must be re-authorized on the Apps Script side via `requireRole`/`requireSuperAdmin` or a narrower helper.

Password hashes are currently verified by the trusted Next.js server after retrieval from Apps Script — `authUserByEmail` results must never be exposed to browser code.

### RBAC model

- `ROLE_SUPER_ADMIN` — system owner; only role that can manage users, roles, permissions, system settings, database setup, and Drive setup.
- `ROLE_NEXUS_ADMIN` — operational admin (candidates/employees/documents/timesheets/etc.); cannot escalate itself, create/delete a Super Admin, or manage permissions/settings.

`src/lib/authz.ts` (`getCurrentAppUser`, `isSuperAdmin`, `requireAnyRole`) is the Next.js-side RBAC surface, sourced from the Prisma `User`/`Role` tables via `src/services/userService.ts` — not from GAS. The GAS-side equivalents (`isSuperAdmin`, `requireSuperAdmin`, `canManageUsers`, `canManageRoles`, `canManageSystemSettings`, `preventLastSuperAdminDeletion`) live in `../src/security.gs` and guard the Apps Script bridge (`../src/apiService.gs`) independently — keep both sides in sync when changing permissions.

### Layout

- `src/app/` — App Router; one authenticated dashboard shell plus API routes under `src/app/api/*` (auth, documents, exports, opportunities, project-execution, templates).
- `src/proxy.ts` — rewrites production-friendly route aliases (`/admin/users`, `/client/feedback`, `/resource/onboarding`, `/operations/*`, `/finance/gr-invoices`, …) to `/?section=...`. This is the map to update when adding a dashboard section.
- `src/lib/` — cross-cutting: `session.ts` (signed HTTP-only cookies), `authz.ts` (RBAC checks), `gas-client.ts` (the only code allowed to call Apps Script), `db.ts` (Prisma client), `env.ts`, `password.ts` (bcrypt), `ids.ts`.
- `src/services/` — one service per domain: `clientService`, `invoiceService`, `projectExecutionService`, `ratecardService`, `talentPlanningService`, `deliveryGovernanceService`, `templateManagementService`, `userService`, `auditService`, `documentService`, `frameworkSettingsService`, `googleDriveGasClient.ts`. Each is backed by Prisma except where it deliberately calls out to GAS for Drive documents.
- `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` — PostgreSQL schema, migrations, seed data.
- `src/scripts/importGoogleSheetToDb.ts` — the legacy Sheets/Excel → PostgreSQL importer described above.

### Apps Script dependency (one level up, `../src/`)

Frontend changes that touch documents, roles/permissions, or any Sheets-backed data usually require a matching change to `../src/apiService.gs` (the bridge this app calls) plus redeploying it as a new Apps Script Web App version. `../src/databaseSchema.gs` + `setupDatabase()` govern the legacy Sheets schema; it's idempotent and additive-only (missing columns get appended, never overwritten).

### Drive folder structure & document naming

The canonical Drive tree and per-role access recommendations are documented in `../folder-architecture.md`; document filenames follow `YYYYMMDD_CLIENT_RESOURCEID_DOCUMENTTYPE_VERSION`. Never share Drive parent folders directly with clients/resources — access must go through the app/API. Payroll/margin/cost data (`06_HR_PAYROLL_INTERNAL`) must never be exposed to clients.

### Repo note

This `web/` directory has its own nested `.git`, separate from the repository root's. Be aware of which repo you're in before running git commands — root-level git operations won't see changes here, and vice versa.

## Environment variables

Full tables are in `../docs/environment-variables.md`. Essentials for `web/.env.local`: `NEXUS_GAS_WEB_APP_URL`, `NEXUS_GAS_API_SECRET` (must match the value set in Apps Script Script Properties), `NEXUS_SESSION_SECRET`, `DATABASE_URL`, optionally `BCRYPT_SALT_ROUNDS`. Never commit `.env.local`, service account keys, or other secrets.
