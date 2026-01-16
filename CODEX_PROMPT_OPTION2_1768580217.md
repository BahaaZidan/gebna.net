# Codex Prompt — Implement Option 2 (HTTP Publish + WS Fanout) for DO-backed PubSub

Copy/paste this into Codex. The goal is to switch the Phase 5 pubsub architecture to **publish via HTTP POST to the Durable Object**, while keeping **WebSockets only for Worker↔DO fanout** (receiving broadcasts). This must fix the current issue where subscriptions don’t reliably receive subsequent events and must avoid Cloudflare cross-request promise resolution warnings.

## Hard constraints
- **Backend only.** Do not touch any frontend.
- Keep resolver logic in `apps/backend/src/lib/graphql/resolvers.ts` (helper modules like `pubsub.ts`/`context.ts` are allowed if already present).
- TypeScript only, avoid `any`.
- Minimal diff: change only what’s needed to switch publish transport.

## Current situation (assume existing files)
There is already:
- Durable Object: `apps/backend/src/lib/durable-objects/conversation-events.ts`
- Worker pubsub layer: `apps/backend/src/lib/graphql/pubsub.ts`
- Yoga context wiring: `apps/backend/src/lib/graphql/context.ts`
- Wrangler bindings: `CONVERSATION_EVENTS` + `CONVERSATION_EVENTS_SECRET`

Right now the Worker uses a Worker↔DO WebSocket to both publish and receive events, with pending queues / `waitUntil`. We want to remove WS publishing.

---

# Goal architecture

## Subscribe (fanout)
- Worker maintains **one WebSocket connection per `conversationId` per Worker instance** to the DO.
- DO broadcasts events over that WS to all Worker instances connected for that conversation.
- Worker receives WS messages and dispatches them into Yoga’s local `EventTarget` (so GraphQL subscriptions fire).

## Publish (send)
- Worker publishes by calling `DOStub.fetch()` with **HTTP POST** (no Worker↔DO WS needed for publishing).
- DO validates secret header, assigns `seq`, then broadcasts to WS-connected Workers.
- Worker MUST NOT drop “self-originated” events, because the DO echo is the delivery path to local subscriptions too.

---

# Tasks

## 1) Update Durable Object to support HTTP publish
File: `apps/backend/src/lib/durable-objects/conversation-events.ts`

Add/modify `fetch(request)` so that:

### A) WebSocket upgrade path (unchanged purpose)
- Continue to accept Worker↔DO WebSocket upgrades for fanout.
- Keep secret gating (e.g., header `X-Conversation-Events-Secret`).

### B) NEW: HTTP POST publish endpoint
- If `request.method === "POST"`:
  - Validate secret header exactly like WS path.
  - Parse JSON body of the form:
    ```json
    {
      "type": "publish",
      "event": {
        "conversationId": "...",
        "topic": "...",
        "payload": {...},
        "sourceId": "...",
        "seq": null
      }
    }
    ```
    You may adjust the envelope shape to match current pubsub types, but keep it JSON-only.
  - Assign/increment `seq` in the DO (**persist in DO storage** so it survives restarts).
  - Broadcast the fully populated envelope (with `seq`) to all connected Worker sockets.
  - Return `204 No Content` on success.
- Ensure errors do **not** leak whether the conversation exists.

---

## 2) Update Worker pubsub to publish via DO.fetch(POST) and stop WS publishing
File: `apps/backend/src/lib/graphql/pubsub.ts`

### A) Remove WS publish path
- Delete or bypass `ConversationEventConnection.publish()` logic that queues pending messages and uses `waitUntil`.
- Keep WS connection code only for receiving broadcasts and dispatching into local `EventTarget`.

### B) Implement HTTP publish in hub/publisher
- In the code path that currently calls `connection.publish(...)` for each event:
  - Instead:
    - derive DO id from `conversationId` (`env.CONVERSATION_EVENTS.idFromName(conversationId)`)
    - `const stub = env.CONVERSATION_EVENTS.get(id)`
    - `await stub.fetch("https://conversation-events/publish", { method:"POST", headers:{...secret...}, body: JSON.stringify(...) })`
  - Use the same secret header name as the DO expects.
- Keep publishes **awaited** (no `waitUntil` required). Optional: also add `waitUntil` as non-essential backup.

### C) Ensure Worker does NOT drop self events
- If there is any logic like:
  - “ignore events where `envelope.sourceId === this.sourceId`”
  remove it. We rely on DO echo for local delivery.

### D) Keep “one WS per conversation per Worker instance”
- Existing logic for `ensureSocket(conversationId)` should remain:
  - connect to DO WS only when first subscriber appears
  - close after idle timeout when last subscriber unsubscribes

---

## 3) Context wiring should remain stable
File: `apps/backend/src/lib/graphql/context.ts`

- Ensure the created pubsub uses the local `EventTarget` as Yoga’s source.
- Ensure event distribution comes from DO broadcasts into local dispatch.
- No frontend changes.

---

## 4) Update report and tests
- Append to `IMPLICIT_PROTOCOL_SWITCHING_REPORT.md` under Phase 5:
  - “Publishing is now HTTP POST to DO; WS is receive-only”
  - security assumptions (secret header)
  - limitations (at-least-once; possible duplicates; `seq` usage)
- Update “How to test” section:
  - open subscription client A
  - send messages from session B repeatedly
  - confirm A receives every event (not just first)

---

# Acceptance criteria
- Subscriptions receive **every** message/delivery update, not just the first.
- No Cloudflare cross-request promise resolution warnings.
- DO assigns monotonically increasing `seq` per conversation and includes it in broadcast payload.
- No WS publishing remains; only HTTP POST for publish.
- No frontend touched.

Proceed with the minimal diff.
