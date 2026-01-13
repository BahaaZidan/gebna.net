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
