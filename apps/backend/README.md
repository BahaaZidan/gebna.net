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

### Testing the cron jobs

```bash
curl "http://localhost:5173/cdn-cgi/handler/scheduled?cron=30+*/6+*+*+*"
```

_If you get r2 header errors, restart the dev server_

### How to test inbound email locally

Based on Cloudflare Email Routing local dev (`https://developers.cloudflare.com/email-routing/email-workers/local-development/`). Start the backend worker locally (e.g., `pnpm --filter backend dev`) with `SEEDING_ENDPOINTS_ENABLED=true` and seed the demo data (`/seed/demo` seeds users `demo@gebna.net`, `fatima@gebna.net`, `omar@gebna.net`).

- Success (delivers to seeded demo user):

Expected: worker ingests a PRIVATE conversation between `demo@gebna.net` and `fatima@gebna.net` with a message and delivery row (`transport=GEBNA_DM`, status `DELIVERED`).

```bash
curl --request POST 'http://localhost:5173/cdn-cgi/handler/email' \
--url-query 'from=fatima@gebna.net' \
--url-query 'to=demo@gebna.net' \
--header 'Content-Type: application/json' \
--data-raw 'Received: from smtp.example.com (127.0.0.1)
      by cloudflare-email.com (unknown) id 4fwwffRXOpyR
      for <demo@gebna.net>; Tue, 27 Aug 2024 15:50:20 +0000
From: "Fatima" <fatima@gebna.net>
Reply-To: fatima@gebna.net
To: demo@gebna.net
Subject: Testing Email Workers Local Dev
Content-Type: text/html; charset="windows-1252"
X-Mailer: Curl
Date: Tue, 27 Aug 2024 08:49:44 -0700
Message-ID: <6114391943504294873000@ZSH-GHOSTTY>

Hi there'
```

- Failure (address not found):

```bash
curl --request POST 'http://localhost:5173/cdn-cgi/handler/email' \
--url-query 'from=fatima@gebna.net' \
--url-query 'to=missing@gebna.net' \
--header 'Content-Type: application/json' \
--data-raw 'Received: from smtp.example.com (127.0.0.1)
      by cloudflare-email.com (unknown) id 4fwwffRXOpyR
      for <missing@gebna.net>; Tue, 27 Aug 2024 15:50:20 +0000
From: "Fatima" <fatima@gebna.net>
Reply-To: fatima@gebna.net
To: missing@gebna.net
Subject: Testing Email Workers Local Dev
Content-Type: text/html; charset="windows-1252"
X-Mailer: Curl
Date: Tue, 27 Aug 2024 08:49:44 -0700
Message-ID: <6114391943504294873000@ZSH-GHOSTTY>

Hi there'
```

Expected: worker rejects with `ADDRESS NOT FOUND!` (HTTP 550 in local simulation).
