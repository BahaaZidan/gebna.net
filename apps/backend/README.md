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

You can override defaults with `SEED_USERNAME`, `SEED_PASSWORD`, `SEED_NAME`, or reset an existing demo user with `SEED_RESET=true` or `--reset`.
