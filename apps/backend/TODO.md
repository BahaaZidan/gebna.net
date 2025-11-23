## Compliance
- Emit `Identity/changes` notifications and serve the method alongside the existing `Identity/get` and `Identity/set` handlers.
- Introduce persistent push-subscription storage plus `PushSubscription/get/set/destroy` endpoints and advertise them in the session object.
- Make `/jmap/event-source/:accountId` honor the full RFC 8620 query contract (types filters, close-after semantics, etc.) instead of the current custom poller.
- Destroy empty threads and emit `Thread/destroy` state when the last email is removed.

## Performance
- Replace the broad `LIKE` scans in `Email/query` with an indexed/FTS-backed search table so text filters stop scanning entire tables.
- Cache per-mailbox total/unread counters (e.g., via triggers) instead of recomputing grouped counts on every `Mailbox/get`.
- Add change-log compaction/GC so `change_log` growth does not slow every `Email/changes`/event-source poll.
- Avoid downloading entire MIME blobs from R2 when populating `bodyValues`; persist truncated per-part text or stream ranges.
- Track account storage usage incrementally rather than recomputing `SUM(blob.size)` on every blob upload.
- Add a native `collapseThreads` path to `Email/query` so the server can efficiently return one id per thread when requested.

## Security
- Lock down structured draft creation so `Email/set` without a `blobId` can only emit `From`/`Sender` addresses that belong to the user’s identities.
- Enforce the declared `maxConcurrentRequests` and `maxConcurrentUpload` limits by tracking in-flight operations.
- Integrate DKIM/DMARC signing (and SES configuration-set enforcement) into the outbound transport so messages are authenticated.
- Scan inbound uploads/attachments for malware before persisting them to R2 and the database.
- Add per-account outbound throttling/abuse detection inside the submission queue using SES webhook feedback to suspend compromised accounts.
