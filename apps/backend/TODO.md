# TODO — JMAP Server Completion (Gebna Mail)

This document tracks the remaining work required for a fully fledged, secure, spec-compliant JMAP server.

---

## 1. Outbound Email Layer

- Queued retries now run via the submission queue; next add SES webhook ingestion for final delivery/bounce events.
- Track provider delivery events in `emailSubmissionTable` so clients see final state transitions.

---

## 2. Upload Token Workflow (`uploadTable`)

**Module:** `jmap-blob.routes.ts`  
**Tables:** `uploadTable`, `blobTable`, `accountBlobTable`

### Remaining Tasks
- Add background cleanup for expired tokens (current implementation prunes opportunistically).
- Expose a dedicated API to list/inspect active uploads if needed.
- Enforce per-account quotas before issuing new tokens.

---

## 3. Cleanup Cron

- Delete expired `uploadTable` rows.
- GC orphaned blobs.
- Enforce mailbox role constraints.

---

## 4. Search (Optional Phase)

- Implement subject/snippet search.
- Add FTS table or SQLite trigram indexing.
