# Phase 0

## Alignment decisions
- DeliveryReceipt.error is nullable in DB (`message_delivery.error`) but non-null in GraphQL; will expose empty string when no error to satisfy schema without changing semantics.
- DeliveryReceipt timestamp will use `message_delivery.latestStatusChangeAt` (non-null). There is no dedicated `deliveredAt` column; no change planned.
- Message.bodyText is nullable in DB but non-null in GraphQL; will coerce null/undefined to an empty string when resolving. `bodyHTML` remains nullable and is not exposed in the current schema.
- Enums align: Transport (`EMAIL`, `GEBNA_DM`) and DeliveryStatus (`QUEUED`, `SENT`, `DELIVERED`, `READ`, `FAILED`) match between GraphQL and DB.

## Identity + authorship linkage invariants
- Messages reference senders via `message.senderIdentityId` (non-null FK to `identity.id`).
- Conversation membership is represented by `conversation_participant` (unique per `conversationId` + `identityId`) with role/state, joinedAt, and optional `lastReadMessageId` pointing to `message.id`.
- Per-recipient delivery rows live in `message_delivery` (unique per `messageId` + `recipientIdentityId`) and store `transport`, `status`, `latestStatusChangeAt`, and optional `error`.

## Status contract
- Initial `message_delivery.status`: `QUEUED` for all transports; `latestStatusChangeAt` set on insert.
- Status meanings:
  - `QUEUED`: delivery row created; not yet handed to a transport.
  - `SENT`: handed to a transport (DM: enqueued/published to recipient connections; EMAIL: provider accepted).
  - `DELIVERED`: DM: recipient side acknowledged receipt/persistence; EMAIL: provider confirms delivery (else remains `SENT` when unknown).
  - `READ`: recipient marked as read (e.g., via conversation read pointers).
  - `FAILED`: delivery attempt errored; `error` contains provider/system message.
- `DeliveryReceipt.at` will surface `latestStatusChangeAt` for the current status.

## Schema tweaks
- No schema/DB changes applied. Resolver coercions (for nullable `bodyText`/`error`) will be handled in Phase 1.

## How to test
- No runtime changes for Phase 0.

## Files changed/added
- `IMPLICIT_PROTOCOL_SWITCHING_REPORT.md` (this report).

## Known gaps deferred
- No dedicated `deliveredAt` column; timelines rely on `latestStatusChangeAt`.
- Resolver coercions and status transitions still need implementation in Phase 1+.

## Phase 1

### What changed (behavior)
- Implemented GraphQL resolvers for conversation/message flows: membership-checked `sendMessage` mutation creates `message` rows and per-recipient `message_delivery` rows with initial status `QUEUED`, `latestStatusChangeAt` set on insert, and `transport` chosen by recipient identity kind (GEBNA_USER → GEBNA_DM, EXTERNAL_EMAIL → EMAIL).
- Transport decision summary now returned with deterministic `chosen` rule: `GEBNA_DM` if all recipients are Gebna users, otherwise `EMAIL`; includes per-recipient reasons.
- Idempotency: `message.id` is deterministic (`cm:<conversationId>:<clientMutationId>`); retries return the existing message and backfill any missing deliveries.
- Read paths now load deliveries, participants, viewer state defaults, message lists, and sender/recipient identities with nullability coercions (`bodyText`/`error` → empty string, `DeliveryReceipt.at` → `latestStatusChangeAt`).
- Conversation and identity helpers auto-create viewer identity (GEBNA_USER) when missing using `<username>@gebna.net`.
- Added `addConversationParticipants` mutation to append new identities/participants to an existing conversation when the caller is already a participant.

### Files changed/added
- apps/backend/src/lib/graphql/resolvers.ts
- IMPLICIT_PROTOCOL_SWITCHING_REPORT.md

### Assumptions / invariants
- Conversation membership is required to send; only ACTIVE participants are considered. Viewer identity is derived/created from the authenticated user’s username with kind `GEBNA_USER`.
- Private conversations keyed by sorted participant identity ids (`dmKey`); titles default to empty string if null.
- Default mailbox for viewer state is IMPORTANT; unread counts are zeroed on mark-as-read but not auto-incremented on send in this phase.
- `lastMessage` requires at least one message in a conversation (will throw if queried before any message exists).

### How to test
- Create or reuse identities for recipients (addresses ending with `@gebna.net` are treated as `GEBNA_USER`, others as `EXTERNAL_EMAIL`).
- Run `upsertConversation` with kind PRIVATE/GROUP to include the viewer and desired recipients.
- Call `sendMessage` with the conversation id, bodyText, and clientMutationId; expect one `message_delivery` per recipient with status `QUEUED` and transport per identity kind.
- Query the conversation/messages/delivery fields to verify transports, statuses, and non-null string coercions; `decision.chosen` should be `GEBNA_DM` only when all recipients are Gebna users.

### Known gaps intentionally deferred
- Unread count increments for recipients and richer mailbox routing are not implemented yet.
- Contact search filtering is minimal; viewer state defaults when absent.
- `lastMessage` resolution depends on at least one message existing; no placeholder messages are created on conversation upsert.

## Phase 2

### What changed (behavior)
- Rebuilt demo seeding to match the new conversation/identity/message_delivery model. Seeds three users (demo, fatima, omar) plus external identities, with both PRIVATE and GROUP conversations, messages, per-recipient deliveries (mixed transports/statuses), and viewer state rows. Seed data is resettable and uses stable IDs plus hashed passwords.
- Raw email seeding endpoint now returns an explicit “unsupported” stub to avoid writing against the legacy schema until ingest is updated in a later phase.

### Files changed/added
- apps/backend/src/lib/seeding/demo.ts
- apps/backend/src/lib/seeding/raw-emails.ts
- IMPLICIT_PROTOCOL_SWITCHING_REPORT.md

### Assumptions
- Seeder controls three dedicated users (`demo`, `fatima`, `omar`); seed IDs are namespaced with stable strings.
- Deleting seeded conversations/identities is safe because they are only created by this script.
- Viewer state mailbox uses `IMPORTANT` for seeded conversations; unread counts are computed from deliveries targeting each viewer identity (non-READ/FAILED).

### How to test
- Ensure `SEEDING_ENDPOINTS_ENABLED=true`.
- POST to `/seed/demo` (optionally `{ "reset": true, "username": "demo", "password": "DemoPassword!23", "name": "Gebna Demo" }`). Verify response counts and that identities/conversations/messages/deliveries are present in the DB.
- Confirm `/seed/raw-emails` returns the “unsupported” status (stubbed until ingest work lands).

### Known gaps intentionally deferred
- Raw email seeding is stubbed; will be reintroduced once inbound ingest aligns with the new schema (Phase 3).
- Seed demo does not attach email metadata/attachments; deliveries are static snapshots rather than lifecycle transitions.

## Phase 3

### What changed (behavior)
- Inbound email handler now writes to the new conversation/message/message_delivery schema: ensures identities for sender/recipients, creates participants, chooses conversation kind (PRIVATE with dmKey when 2 participants, otherwise GROUP), inserts messages with email metadata, and inserts per-recipient delivery rows (transport by identity kind, status `DELIVERED`, latestStatusChangeAt = receive time).
- Viewer state for the addressed Gebna user is created/upserted with unread count when a delivery targets their identity.

### Files changed/added
- apps/backend/src/worker-handlers/email.ts

### Assumptions
- Participants come from sender + To/Cc/Bcc/Reply-To + addressed user; GROUP conversations always created anew (no threading by Message-Id/References yet).
- Deliveries are marked `DELIVERED` on ingest for all non-sender participants; transports follow identity kind (`GEBNA_USER` → GEBNA_DM, `EXTERNAL_EMAIL` → EMAIL).
- Only the primary addressed Gebna user gets a conversation viewer state update; other local recipients (if any) are not yet handled.

### How to test
- Send an inbound email to `<username>@gebna.net`; after processing, query the conversation/messages via GraphQL:
  - Conversation exists (PRIVATE for 2 participants, GROUP otherwise) with participants for sender and all header recipients.
  - Message contains body text/html and email metadata.
  - `message.delivery` has one row per recipient (excluding sender) with transport mapped by identity kind and status `DELIVERED`.
  - Viewer state for the addressed user is present with unread count > 0 when applicable.

### Known gaps intentionally deferred
- No threading by `Message-Id`/`In-Reply-To`/`References`; GROUP conversations are always new instances.
- No attachment handling or avatar inference in inbound ingest in this phase.
- Additional local Gebna recipients beyond the primary addressed user do not get viewer state updates.
