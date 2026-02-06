<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for the pnpm Workspace

- Nx tooling has been removed; avoid `nx` commands and related MCP tools.
- Use pnpm workspace commands for tasks (e.g., `pnpm -r lint`, `pnpm --filter <pkg> dev`).
- Keep `pnpm-workspace.yaml` updated if you add or move packages.
- Prefer project-level scripts defined in each package's `package.json`.
- TypeScript project references live in `tsconfig.json`; keep them in sync when adding new packages.

<!-- nx configuration end-->
