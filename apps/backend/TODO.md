# TODO — JMAP Server Completion (Gebna Mail)

This document tracks the remaining work required for a fully fledged, secure, spec-compliant JMAP server.

---

## 1. Upload Token Workflow (`uploadTable`)

**Module:** `jmap-blob.routes.ts`  
**Tables:** `uploadTable`, `blobTable`, `accountBlobTable`

### Remaining Tasks
- Add background cleanup for expired tokens (current implementation prunes opportunistically).
- Expose a dedicated API to list/inspect active uploads if needed.
- Enforce per-account quotas before issuing new tokens.

---

## 4. Identity API (`Identity/get`, `Identity/set`)

**Tables:** `identityTable`

### Tasks
- Add JMAP identity methods.
- Enforce single default identity.
- Validate outbound email consistency.

---

## 5. Vacation Response

**Tables:** `vacationResponseTable`

### Tasks
- Add `"VacationResponse/get"` & `"VacationResponse/set"`.
- In inbound path, detect enabled vacation responder and send auto replies.
- Prevent duplicate responses per sender.

---

## 6. Changelog Logging Everywhere

**Tables:** `changeLogTable`, `jmapStateTable`

### Tasks
- Ensure all future mutations write changelog rows.
- Increment modSeq atomically.

---

## 7. Full Capability Advertisement

Add to session response:

```ts
accountCapabilities: {
  "urn:ietf:params:jmap:core": {},
  "urn:ietf:params:jmap:mail": {},
  "urn:ietf:params:jmap:submission": {},
  "urn:ietf:params:jmap:vacationresponse": {}
}
```

---

## 8. Outbound Email Layer

- Current SES transport exists; extend with queued retries + webhook ingestion.
- Track provider delivery events in `emailSubmissionTable`.

---

## 9. Search (Optional Phase)

- Implement subject/snippet search.
- Add FTS table or SQLite trigram indexing.

---

## 10. Cleanup Cron

- Delete expired `uploadTable` rows.
- GC orphaned blobs.
- Enforce mailbox role constraints.
