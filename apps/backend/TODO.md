# TODO — JMAP Server Completion (Gebna Mail)

This document tracks the remaining work required for a fully fledged, secure, spec-compliant JMAP server.

---

## 1. Upload Token Workflow (`uploadTable`)

**Module:** `jmap-blob.routes.ts`  
**Tables:** `uploadTable`, `blobTable`, `accountBlobTable`

### Remaining Tasks
- Expose a dedicated API to list/inspect active uploads if needed.
- Enforce per-account quotas before issuing new tokens.

---

## 2. Cleanup Cron

- Delete expired `uploadTable` rows.
- GC orphaned blobs.
- Enforce mailbox role constraints.

---

## 3. Search (Optional Phase)

- Implement subject/snippet search.
- Add FTS table or SQLite trigram indexing.
