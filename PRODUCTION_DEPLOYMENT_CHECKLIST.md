# NEXUS SEVENFOLD Production Deployment Checklist

This checklist is mandatory before any production release that can affect Neon, Vercel, authentication, document access, or workflow data.

## 1. Owner Approval Gate

- [ ] Release owner confirms deployment scope.
- [ ] Product owner confirms user-facing changes.
- [ ] Technical owner confirms validation results.
- [ ] Database owner explicitly approves any production DB change before it is run.
- [ ] Approval reference is recorded in the release notes or ticket.

## 2. Neon Backup Step

- [ ] Confirm target Neon project and branch from Vercel environment, without exposing credentials.
- [ ] Create or verify a current Neon backup/snapshot before migration.
- [ ] Record backup timestamp and owner.
- [ ] Confirm restore procedure is understood before touching production data.

Never paste or commit Neon connection strings, passwords, pooled URLs, or console screenshots containing credentials.

## 3. Vercel Environment Variable Checklist

Verify in Vercel Project Settings only. Do not commit `.env.local`.

- [ ] `DATABASE_URL`
- [ ] `DIRECT_DATABASE_URL` if used by controlled migrations
- [ ] `NEXUS_SESSION_SECRET`
- [ ] `NEXUS_GAS_WEB_APP_URL` if Google Drive/GAS adapter is enabled
- [ ] `NEXUS_GAS_API_SECRET` if Google Drive/GAS adapter is enabled
- [ ] Any auth provider keys currently used by the deployed stack
- [ ] No local-only URLs such as `127.0.0.1` or `localhost`
- [ ] No test passwords, service account JSON, or key text files committed

Secret-safe files that must stay ignored:

- `.env`
- `.env.local`
- `.env.*.local`
- `*service-account*.json`
- `*key*.txt`
- `AI key dan local link.txt`

## 4. Migration Review Step

- [ ] Review Prisma schema diff.
- [ ] Confirm migration is additive.
- [ ] Confirm no table drop.
- [ ] Confirm no column drop.
- [ ] Confirm no destructive default or required field that can fail existing rows.
- [ ] Confirm no `prisma migrate reset`.
- [ ] Confirm no `prisma db push --accept-data-loss`.
- [ ] Confirm rollback plan covers schema and application rollback.

No production migration may run without owner approval.

## 5. Controlled Migration Command

Only run after backup and owner approval.

Recommended controlled production migration pattern:

```bash
npx prisma migrate deploy
```

Run it only from an approved production environment with the intended production database URL loaded securely.

Forbidden production commands:

```bash
npx prisma migrate reset
npx prisma db push --accept-data-loss
```

## 6. Build Verification

Run locally before deploying:

```bash
npm run db:validate
npm run db:generate
npm run lint
npm run build
```

Expected result:

- [ ] Prisma validate passes.
- [ ] Prisma generate passes.
- [ ] Lint passes.
- [ ] Build passes.

## 7. Vercel Deployment

Preferred low-risk flow:

```bash
vercel deploy
```

Validate preview URL first. Promote only after smoke testing:

```bash
vercel promote <preview-deployment-url>
```

Direct production deploy is allowed only with owner approval:

```bash
vercel deploy --prod
```

## 8. Health Check

After deploy:

- [ ] App loads without server error.
- [ ] Login works.
- [ ] Dashboard loads.
- [ ] Project Execution loads.
- [ ] Governance loads.
- [ ] Export endpoint downloads a workbook.
- [ ] Document viewer still respects access rules.
- [ ] No secret values appear in logs or UI.

## 9. Smoke Test

Minimum smoke:

- [ ] Super Admin login.
- [ ] Create or update a non-production test user.
- [ ] Open Project Execution.
- [ ] Save a Resource Demand test row.
- [ ] Save a Commercial Flow test row.
- [ ] Export Project Execution workbook.
- [ ] Open Governance dashboard and confirm rollups render.
- [ ] Logout.

Do not use production customer secrets or real sensitive documents for smoke data.

## 10. Rollback Plan

Application rollback:

```bash
vercel rollback
```

or roll back to a known deployment:

```bash
vercel rollback <deployment-url-or-id>
```

Database rollback:

- [ ] Stop write traffic if data integrity is at risk.
- [ ] Restore from the verified Neon backup/snapshot only after database owner approval.
- [ ] Record incident notes, root cause, and recovery timestamp.

## 11. Production Change Record

Record:

- [ ] Git commit SHA.
- [ ] Vercel deployment URL.
- [ ] Migration ID if any.
- [ ] Neon backup timestamp.
- [ ] Approver.
- [ ] Smoke test result.
- [ ] Rollback owner.
