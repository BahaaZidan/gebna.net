# Monorepo Generator Agent Prompt

You are a coding agent operating on an **empty folder**. Generate a **minimal, simplest-working** monorepo with **pnpm workspaces** + **Turborepo** + **TypeScript** everywhere.

## Apps (names + namespaces are mandatory)

Create these apps and **namespace them exactly**:

- `apps/mobile` → **Expo** app (iOS/Android + web)
- `apps/desktop` → **TanStack Start** React app (web)
- `apps/backend` → **Vite** app that builds a **Cloudflare Worker** using the **official Cloudflare Vite plugin**

Workspace names must be consistent (e.g. `@repo/mobile`, `@repo/desktop`, `@repo/backend`).

## Packages

- `packages/ui-components` → pure presentational components using **React Native primitives** and styled via **Tailwind + Uniwind**
- `packages/data-components` → depends on `ui-components`, uses **Relay**, includes at least one fragment-based component

---

## Non-negotiable requirements

1. **No hallucinations**: do not invent config keys/APIs. If uncertain, consult official docs and note the source in README comments.
2. **Type-safe**: no `any`, no unsafe casts.
3. **Shared code works**:
   - both `apps/mobile` and `apps/desktop` render a styled `Button` from `ui-components`
   - both render a Relay fragment component from `data-components`
4. **Relay is fully wired and runs from repo root**.
5. **React Native Web works with TanStack Start**:
   - desktop must render the shared RN-primitive components via `react-native-web`
   - configure aliasing so `react-native` resolves to `react-native-web` in desktop bundling
6. Keep it minimal.

---

## CRITICAL FINAL CHANGE (must follow): Root schema file for Relay

- Create **`./schema.graphql` at the repo root**.
- Relay configuration MUST use this exact file as the schema source.
- Do **not** place the schema inside apps/packages for Relay purposes.
- Relay compiler must succeed using this root schema file.

---

## Repo layout (exact)

```text
.
├─ apps/
│  ├─ mobile/
│  ├─ desktop/
│  └─ backend/
├─ packages/
│  ├─ ui-components/
│  └─ data-components/
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ schema.graphql
└─ README.md
```

---

## Implementation details you must satisfy

### 1) Root

- `pnpm-workspace.yaml` includes `apps/*` and `packages/*`
- `turbo.json` pipelines for: `dev`, `build`, `typecheck`, `relay`
- Root `package.json`:
  - `"packageManager": "pnpm@<PINNED_VERSION>"`
  - scripts:
    - `dev` runs dev tasks via turbo
    - `typecheck` runs TS typecheck across repo
    - `relay` runs Relay compiler across repo and uses `./schema.graphql`
- `tsconfig.base.json` shared by all projects

### 2) `packages/ui-components`

- Exports at least `Button`
- Implemented using RN primitives (`Pressable`, `Text`, `View`)
- Styled via Uniwind/Tailwind `className` strings
- Visible styling (padding/background/etc)

### 3) `packages/data-components` (Relay)

- Depends on `ui-components`
- Contains:
  - A fragment in `.graphql`
  - A component that uses Relay `useFragment` (or equivalent)
- Relay artifacts generated deterministically (choose simplest)
- Relay compiler uses **root** `./schema.graphql` (no other schema copies)

### 4) `apps/mobile` (Expo)

- Runs:
  - `pnpm -C apps/mobile start`
  - `pnpm -C apps/mobile web`
- Renders:
  - `Button`
  - Relay fragment component
- Configure Metro for workspace package resolution

### 5) `apps/desktop` (TanStack Start + RN Web)

- Runs:
  - `pnpm -C apps/desktop dev`
- Renders the same shared components from both packages
- Must alias:
  - `react-native` → `react-native-web`
- Ensure any required setup for RN Web + CSS + Uniwind/Tailwind is included (minimal)

### 6) `apps/backend` (Vite + Cloudflare plugin)

- Vite + Cloudflare Vite plugin
- Minimal GraphQL endpoint is fine
- Runs:
  - `pnpm -C apps/backend dev`
- Backend can reference the root schema if needed, but Relay must be configured strictly from `./schema.graphql`

---

## Strict “no guessing” rules

If a step depends on exact tooling commands/config (TanStack Start scaffold, Cloudflare Vite plugin, Relay compiler):

- implement the documented approach
- add a short README comment noting the official source (plain text)

---

## Output format required

1. Concise plan (≤ 15 lines)
2. File tree
3. Every file’s contents (grouped by path) in fenced code blocks
4. Exact commands to run in order:
   - install
   - relay compile
   - backend dev
   - desktop dev
   - mobile start + mobile web
   - typecheck

---

## Do NOT ask me questions

Pick stable versions, pick artifact locations, pick SDL vs anything else — but the schema file MUST be `./schema.graphql`.

**Now generate the repo.**
