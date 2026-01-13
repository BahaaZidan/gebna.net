# Codex Task Plan — Implicit Protocol Switching (Phased)

This document is the **single source of truth** for what to implement, in what order, and under what constraints.  
You (Codex) must execute **one phase at a time**. Do **not** start a later phase until the current phase is complete and verified.

## Global constraints (apply to all phases)

- **Backend only.** Do not touch any frontend app (e.g. anything under `apps/web`).
- Resolver code lives in **one file only** and must match existing style/structure:
  - `apps/backend/src/lib/graphql/resolvers.ts`
- Prefer **type-safe** TypeScript. Avoid `any` and unsafe casting.
- Keep changes minimal and local. No broad refactors.
- You may touch shared packages if required, but you must **explicitly list those files** in the phase report.
- After each phase, output a Markdown report at repo root:
  - `IMPLICIT_PROTOCOL_SWITCHING_REPORT.md`
  - Append a new section `## Phase N` containing:
    - What changed (behavior)
    - Files changed/added
    - Assumptions/invariants relied on
    - How to test
    - Known gaps intentionally deferred to later phases

## Inputs to read first (before Phase 0)

- GraphQL schema: `packages/graphql/schema.graphql`
- Drizzle schema: `apps/backend/src/lib/db/schema.ts`
- Existing resolver file (style reference): `apps/backend/src/lib/graphql/resolvers.ts`
- Existing email ingest pipeline code: `apps/backend/src/worker-handlers/email.ts`
- Existing seed scripts: `apps/backend/src/lib/seeding/raw-emails.ts`

---

# Phase 0 — Pre-flight alignment (cheap, prevents rework)

**Goal:** Ensure schema/DB/contracts are aligned before implementing logic.

**Non-goals:**

- No realtime
- No ingest changes
- No seed changes
- No outbound email

## Phase 0 requirements

### A) Nullability + enum alignment

- Compare GraphQL nullability with DB nullability for:
  - `DeliveryReceipt.error`
  - `deliveredAt`
  - optional message fields (e.g. `bodyText`, `bodyHTML` if they exist)
- Ensure GraphQL enums match DB enums exactly (names and semantics):
  - `Transport`
  - `DeliveryStatus`
- If mismatches exist:
  - Prefer fixing in resolvers via safe defaults _only if it doesn’t distort meaning_.
  - Otherwise apply the minimal schema change necessary (backend-only) and document it.

### B) Identity + authorship linkage invariants

- Confirm how a `message` is linked to the sender (e.g., `senderIdentityId` or equivalent).
- Confirm how conversation membership is represented (participants table, join table, etc.).
- If any required linkage is missing, add the smallest necessary glue logic (not big migrations unless unavoidable) and document.

### C) Status contract (define now; implement gradually)

Define and document the semantics for delivery status transitions (even if Phase 1 only uses the initial status).

At minimum, decide:

- Initial status for newly created `message_delivery` rows: `QUEUED` / `PENDING` (whatever enum exists).
- What “DELIVERED” means for `GEBNA_DM` in Phase 4/5:
  - delivered to recipient devices? delivered to server mailbox? acknowledged by client?
- What “SENT” vs “DELIVERED” means for `EMAIL` in Phase 6:
  - provider accepted vs recipient mailbox delivered (often not knowable)

Write the contract into `IMPLICIT_PROTOCOL_SWITCHING_REPORT.md` under `## Phase 0`.

## Phase 0 report

Create (or append) `IMPLICIT_PROTOCOL_SWITCHING_REPORT.md`:

- `## Phase 0`
- list all alignment decisions and any schema tweaks

---

# Phase 1 — DB write/read correctness (no realtime)

**Goal:** Implement the core DB-backed semantics for implicit protocol switching:

- Create message records
- Create per-recipient delivery records
- Read them back through GraphQL

**Non-goals:**

- No realtime infrastructure
- No inbound email ingest changes
- No seeding changes
- No outbound email sending (stub only if strictly necessary for compilation, but do not wire it)

## Phase 1 requirements

### A) GraphQL resolvers (in `apps/backend/src/lib/graphql/resolvers.ts` only)

Implement missing resolvers required for these behaviors:

1. **Send message mutation** (name per schema, e.g. `sendMessage(input)`):

- Authenticate using existing backend auth pattern.
- Validate the sender is allowed to send in the conversation (membership).
- Create a `message` row.
- Derive recipients:
  - If schema implies conversation participants, use those (excluding sender where appropriate).
  - If schema explicitly provides recipients, validate they are part of the conversation (unless your system allows adding participants implicitly; if so, document it as an assumption).
- For each recipient identity:
  - Compute per-recipient transport:
    - `identity.kind == GEBNA_USER` → `GEBNA_DM`
    - `identity.kind == EXTERNAL_EMAIL` → `EMAIL`
  - Insert `message_delivery` row keyed by `(messageId, recipientIdentityId)` with:
    - `transport`
    - initial `status` (per Phase 0 contract)
    - `deliveredAt = null`
    - `error = null`

Return the payload matching schema exactly, including the transport decision summary:

- `decision.perRecipient[]` must reflect the above rule.
- If schema also expects a `chosen` transport, set it deterministically (e.g. `GEBNA_DM` if all recipients are local else `EMAIL`), and document the rule in the report.

2. **Read paths / field resolvers**
   Implement/finish resolvers so clients can query:

- `Message.delivery: [DeliveryReceipt!]!` (load from `message_delivery`)
- `Conversation.messages` / `Conversation.participants` / any list fields needed to observe the new semantics
- Ensure `DeliveryReceipt.transport` is returned per recipient.

### B) Idempotency (only if schema includes `clientMutationId`)

If `SendMessageInput` contains `clientMutationId`:

- Implement idempotency so retrying the same mutation does not create duplicates.
- Use existing patterns if present.
- If none exist, implement a minimal safe dedupe approach and document it clearly in the report.

### C) Phase 1 report

Append `## Phase 1` to `IMPLICIT_PROTOCOL_SWITCHING_REPORT.md`:

- Assumptions (e.g., "every user has an identity record", "conversation participants always exist", etc.)
- Status semantics used for initial delivery records (must match Phase 0 contract)
- Files changed/added
- How to test with GraphQL queries/mutations

## Phase 1 acceptance tests (manual)

- Create a conversation with at least:
  - one `GEBNA_USER` identity recipient
  - one `EXTERNAL_EMAIL` identity recipient
- Call `sendMessage`.
- Query the message and verify:
  - message exists
  - `delivery[]` has one entry per recipient
  - each entry has correct `transport`
  - status is the initial queued/pending value

---

# Phase 2 — Fix/update seeding scripts (unified + resettable)

**Goal:** Update seed scripts so they:

- Match the new DB semantics (identities, participants, deliveries)
- Keep the raw seeding script separate. everything else is unified.
- Are **resettable**
- Provide fixtures for validating Phase 3 ingest work quickly and repeatedly

**Non-goals:**

- No realtime
- No outbound email sending

## Phase 2 requirements

- Find current seed scripts.
- Make seeding:
  - deterministic (same seed data each run unless randomized is intentional)
  - resettable (can wipe and re-seed safely)
  - consistent with new structure:
    - identity records created properly
    - conversations/participants created properly
    - messages created properly
    - message_delivery created properly
- Keep it easy to run locally.

## Phase 2 report

Append `## Phase 2` with:

- Command(s) to reset + seed
- Files changed/added
- Assumptions

---

# Phase 3 — Update inbound email ingest to match new threading semantics

**Goal:** Reorganize inbound email ingestion so that it produces the **same conversation/message/delivery semantics** as Phase 1.

**Non-goals:**

- No realtime
- No outbound email sending

## Phase 3 requirements

- Locate the inbound email routing/ingest pipeline (Cloudflare Email Routing handler + parsing + DB writes).
- Update it to:
  - Create/resolve participants as identities (GEBNA_USER vs EXTERNAL_EMAIL).
  - Create/resolve conversation/threading according to the new participant-based semantics.
  - Insert messages in the same format expected by Phase 1.
  - Insert `message_delivery` rows appropriately for recipients (or document the exact rule if inbound email implies different semantics).

> You must not change the public GraphQL API in Phase 3 unless absolutely necessary. If you do, document it and keep changes minimal.

## Phase 3 report

Append `## Phase 3` including:

- Assumptions about inbound email fields (Message-Id, References, etc.)
- How participant threading is derived for inbound email
- Files changed/added
- How to test (e.g., send an inbound email and then query the conversation/messages)

---

# Phase 4 — Add realtime (GraphQL Yoga + WebSockets, no SSE)

**Goal:** Add realtime updates so clients don’t need to refresh/requery.

**Hard requirements:**

- Follow **GraphQL Yoga docs** for subscriptions over **WebSockets**.
- **No Server-Sent Events (SSE).**
- Prefer implementing without Durable Objects if feasible.
  - If not feasible, you may use a minimal interim approach, but you must document why.
- Do not touch frontend.

## Phase 4 requirements

- Implement GraphQL subscription(s) defined in `schema.graphql` (e.g., `deliveryUpdated(messageId)` or message events).
- Wire Yoga subscriptions over WebSocket.
- When Phase 1/3 code changes `message_delivery` status (or when a new message is created), publish events so subscribers receive updates.
- If there is no event bus in the repo:
  - implement a minimal in-memory PubSub suitable for a single Worker instance and document limitations (multi-instance not coordinated).
  - This is acceptable for Phase 4 as long as limitations are explicit.

## Phase 4 report

Append `## Phase 4` including:

- How to connect via WebSocket
- Limitations (single instance / no coordination)
- Files changed/added
- How to test subscriptions locally

---

# Phase 5 — Production-grade connection coordination (Durable Objects)

**Goal:** Make realtime **production-grade** on Cloudflare by coordinating WebSocket connections via Durable Objects.

**Requirements**

- Introduce Durable Objects as the coordination layer:
  - DO per conversation or per user (choose and justify)
  - handle fanout reliably
  - keep ordering sane
- Keep GraphQL Yoga WebSocket interface; DO provides the backing coordination mechanism.

## Phase 5 report

Append `## Phase 5` with:

- DO design choice and rationale
- Failure modes and reconnection strategy
- Files changed/added
- How to test

---

# Phase 6 — Outbound email sending

**Goal:** Implement actual outbound email delivery for `EMAIL` transport recipients.

**Requirements**

- Replace the Phase 1 stub (if any) with a real provider integration:
  - AWS SES, SendGrid, or later Cloudflare outbound email (if available)
- Update delivery status transitions per Phase 0 contract:
  - queued → sent → delivered/failed (as best as provider allows)
- Maintain idempotency and retry safety.

## Phase 6 report

Append `## Phase 6` with:

- Provider chosen
- How secrets/config are managed
- Retry/idempotency behavior
- Files changed/added
- How to test end-to-end

---

## Operating rules for Codex when executing phases

- Work on **one phase per PR/patch**.
- At the end of each phase:
  - run typecheck/build/tests as applicable
  - ensure backend still starts
  - update `IMPLICIT_PROTOCOL_SWITCHING_REPORT.md` (append the phase section)
- Do not start the next phase until the acceptance tests of the current phase pass.
