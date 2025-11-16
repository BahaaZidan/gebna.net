# TODO — JMAP Server Completion (Gebna Mail)

This document tracks the remaining work required for a fully fledged, secure, spec-compliant JMAP server.

---

## 1. `Email/set` Implementation

**Module:** `jmap.routes.ts`  
**Stub:** `applyEmailSet()`  
**Tables:** `accountMessageTable`, `mailboxMessageTable`, `emailKeywordTable`, `changeLogTable`, `jmapStateTable`

### Tasks
- Implement creation, update, and deletion of emails.
- Update mailbox memberships via `mailboxMessageTable`.
- Maintain flags & keywords via `emailKeywordTable`.
- Log all changes into `changeLogTable` and increment `jmapStateTable.modSeq`.

---

## 2. `EmailSubmission/set` + Outbound Sending

**Module:** `jmap.routes.ts`  
**Stub:** `applyEmailSubmissionSet()`  
**Tables:** `emailSubmissionTable`, `identityTable`, `accountMessageTable`, `changeLogTable`, `jmapStateTable`

### Tasks
- Validate identity + email ownership.
- Insert submission rows.
- Generate SMTP envelope JSON.
- Call outbound delivery stub.
- Update delivery status + changelog + modSeq.

---

## 3. Upload Token Workflow (`uploadTable`)

**Module:** `jmap-blob.routes.ts`  
**Tables:** `uploadTable`, `blobTable`, `accountBlobTable`

### Tasks
- Insert upload token rows in `uploadTable`.
- Add job to clean expired uploads.
- Integrate upload tokens into `Email/set`.

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

## 8. Outbound Email Layer Stub

Create file `outbound.ts`:

```ts
export async function sendEmailOutbound(submission, env) {
  // SMTP or Worker-based delivery
}
```

---

## 9. Search (Optional Phase)

- Implement subject/snippet search.
- Add FTS table or SQLite trigram indexing.

---

## 10. Cleanup Cron

- Delete expired `uploadTable` rows.
- GC orphaned blobs.
- Enforce mailbox role constraints.
