# TODO — JMAP Server Completion (Gebna Mail)

This document tracks the remaining work required for a fully fledged, secure, spec-compliant JMAP server.

---

## 1. Full Capability Advertisement

Ensure the session document advertises every capability implemented:

```ts
accountCapabilities: {
  "urn:ietf:params:jmap:core": {},
  "urn:ietf:params:jmap:mail": {},
  "urn:ietf:params:jmap:submission": {},
  "urn:ietf:params:jmap:vacationresponse": {}
}
```

---

## 2. Changelog Logging Everywhere

**Tables:** `changeLogTable`, `jmapStateTable`

### Tasks
- Ensure all future mutations write changelog rows.
- Increment modSeq atomically.

---

## 3. Outbound Email Layer

- Current SES transport exists; extend with queued retries + webhook ingestion.
- Track provider delivery events in `emailSubmissionTable`.

---

## 4. Upload Token Workflow (`uploadTable`)

**Module:** `jmap-blob.routes.ts`  
**Tables:** `uploadTable`, `blobTable`, `accountBlobTable`

### Remaining Tasks
- Add background cleanup for expired tokens (current implementation prunes opportunistically).
- Expose a dedicated API to list/inspect active uploads if needed.
- Enforce per-account quotas before issuing new tokens.

---

## 5. Cleanup Cron

- Delete expired `uploadTable` rows.
- GC orphaned blobs.
- Enforce mailbox role constraints.

---

## 6. Search (Optional Phase)

- Implement subject/snippet search.
- Add FTS table or SQLite trigram indexing.
