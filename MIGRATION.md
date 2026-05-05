# KosherTable Migration

## Status

- Source path: `/Users/biscuitdh/Projects/Kosher Site`
- Destination: `apps/kosher-table`
- Current state: source copied and locally verified
- Copied on: 2026-04-30

## What Was Copied

- Next app source under `app/`
- React components under `components/`
- shared app logic under `lib/`
- public image assets under `public/`
- app tests under `tests/`
- local scripts under `scripts/`
- app docs under `docs/`
- root app config such as `package.json`, `next.config.mjs`, Tailwind, Vitest, Playwright, Firebase, Docker, and Firestore files

The copy used the current KosherTable working tree. The source repo had uncommitted changes in:

- `components/app-shell.tsx`
- `components/grocery-list-client.tsx`
- `tests/e2e/responsive.spec.ts`

Those current working-tree versions were preserved in this copied app.

## What Stayed External

- `.env`, `.env.*`, and local secret/env files
- `.git`, `.github`, and source repo metadata
- `node_modules`
- `.next`, `.next-build-check`, `.next-export`, `.next-firebase-export`, and `out`
- `.firebase`, test reports, coverage, and TypeScript build info
- `infra/terraform`, Terraform state, `terraform.tfvars`, and plans
- nested `food-guard` mobile app

## Verification Completed

- `npm ci --prefix apps/kosher-table --cache .npm-cache`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm --prefix apps/kosher-table run build`
- `npm run test:kosher-table:e2e`

The Playwright suite passed 66 responsive tests across iPhone, Pixel, and desktop profiles.

## Re-Run Verification

Run these from the webapps root. This first copy keeps the app on its current npm lockfile; pnpm workspace conversion is a later cleanup step.

```sh
npm run install:kosher-table
npm run typecheck
npm test
npm --prefix apps/kosher-table run build
npm run test:kosher-table:e2e
```
