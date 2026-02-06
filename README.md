# Gebna pnpm Workspace

This repository is a pnpm-based monorepo. Nx has been removed; use pnpm workspace commands and per-project scripts to run tasks.

## Layout
- `apps/tipo`: Expo Router app (mobile/web) with Metro + Uniwind.
- `apps/rhodamine`: Vite/Cloudflare worker app and supporting scripts.
- `libs/ui-components`: Shared React component library.
- `libs/types`: Shared TypeScript types.
- `libs/vali`: Validation helpers.

## Running tasks
- Install deps: `pnpm install`
- Dev server for a project: `pnpm --filter <project> dev`
- Lint all projects: `pnpm -r lint`
- Build a project: `pnpm --filter <project> build`

Update `pnpm-workspace.yaml` if you add or move packages.
