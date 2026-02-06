# Minimal Turborepo (Expo + TanStack Start + Cloudflare Worker)

## Layout
- apps/mobile: Expo app (iOS/Android/Web) consuming shared UI + Relay fragment
- apps/desktop: TanStack Start + React Native Web consuming shared UI + Relay fragment
- apps/backend: Cloudflare Worker built with Vite + @cloudflare/vite-plugin
- packages/ui-components: RN-primitive Button styled via Tailwind + Uniwind
- packages/data-components: Relay fragment + presentational wrapper around shared Button
- schema.graphql at repo root feeds Relay compiler (single source of truth)

## Relay
- Config lives in `relay.config.json` and points to `./schema.graphql`
- Compiler target is TypeScript (install/run with `pnpm relay`)

## Styling
- Tailwind v4 + Uniwind per official quickstarts:
  - Metro wrapped with `withUniwindConfig` (`uniwind/metro`)
  - Vite uses `uniwind/vite` and `@tailwindcss/vite`

## TanStack Start
- Uses `@tanstack/react-start` Vite plugin (`tanstackStart`) with manual `routeTree.gen.ts` wiring.

## Cloudflare Worker
- Vite plugin from `@cloudflare/vite-plugin` builds `src/index.ts`
- `wrangler.toml` uses compatibility_date `2026-02-06`

## Commands (from repo root)
- Install deps: `pnpm install`
- Relay artifacts: `pnpm relay`
- Backend dev: `pnpm -C apps/backend dev`
- Desktop dev: `pnpm -C apps/desktop dev`
- Mobile start: `pnpm -C apps/mobile start`
- Mobile web: `pnpm -C apps/mobile web`
- Typecheck: `pnpm typecheck`
