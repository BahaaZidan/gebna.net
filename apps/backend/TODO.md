# TODO — JMAP Server Completion (Gebna Mail)

This document tracks the remaining work required for a fully fledged, secure, spec-compliant JMAP server.

---

## 1. Changelog Logging Everywhere

**Tables:** `changeLogTable`, `jmapStateTable`

### Tasks
- Ensure all future mutations write changelog rows.
- Increment modSeq atomically.

---

## 2. Outbound Email Layer

- Current SES transport exists; extend with queued retries + webhook ingestion.
- Track provider delivery events in `emailSubmissionTable`.

---

## 3. Upload Token Workflow (`uploadTable`)

**Module:** `jmap-blob.routes.ts`  
**Tables:** `uploadTable`, `blobTable`, `accountBlobTable`

### Remaining Tasks
- Add background cleanup for expired tokens (current implementation prunes opportunistically).
- Expose a dedicated API to list/inspect active uploads if needed.
- Enforce per-account quotas before issuing new tokens.

---

## 4. Cleanup Cron

- Delete expired `uploadTable` rows.
- GC orphaned blobs.
- Enforce mailbox role constraints.

---

## 5. Search (Optional Phase)

- Implement subject/snippet search.
- Add FTS table or SQLite trigram indexing.
