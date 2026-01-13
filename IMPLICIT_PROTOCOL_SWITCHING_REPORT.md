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
