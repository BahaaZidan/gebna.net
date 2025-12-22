```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

### Seeding the database

```txt
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
pnpm --filter backend db:seed
```

Seeding now happens via HTTP endpoints guarded by `SEEDING_ENDPOINTS_ENABLED`:

1. Start the dev worker so the endpoints are reachable on `http://localhost:8787`.
2. Set `SEEDING_ENDPOINTS_ENABLED="true"` in `.dev.vars`.
3. Seed the demo user:
   ```txt
   pnpm --filter backend db:seed
   ```
   Add `-- reset` to reset existing demo data: `pnpm --filter backend db:seed -- reset`.
4. Seed the raw emails:
   ```txt
   pnpm --filter backend db:seed:raw
   ```
   Reset seeded raw emails with: `pnpm --filter backend db:seed:raw -- reset`.
