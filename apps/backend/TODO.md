# TODO — JMAP Server Completion (Gebna Mail)

This document tracks the remaining work required for a fully fledged, secure, spec-compliant JMAP server.

---

1. ✅ **Validate capability negotiation** _(Necessary)_  
   Reject requests whose `using` array references unsupported capabilities by emitting the standard `unknownCapability` error before invoking any method.

2. ✅ **Ship full `Mailbox/set` support** _(Necessary)_  
   Implement create/update/destroy with parent/child relationships, role constraints, and enforcement of system mailbox uniqueness.

3. **Expose mailbox rights metadata** _(Necessary)_  
   Return `myRights`, ACL flags, and other required properties from `Mailbox/get`, and persist shared rights if we will support delegation later.

4. **Implement `Email/queryChanges`** _(Necessary)_  
   Track query cursors and expose a compliant endpoint so clients can delta-sync search results.

5. **Expand `Email/get` field selection** _(Necessary)_  
   Honor `properties`, `bodyProperties`, `fetchTextBodyValues`, header filters, and part retrieval so clients can request just the data they need.

6. **Support full `Email/set` drafting workflow** _(Necessary)_  
   Allow patching addresses, headers, body structures, signatures, and metadata without forcing clients to upload pre-built MIME blobs.

7. **Add conditional writes with `ifInState`** _(Necessary)_  
   Enforce optimistic concurrency for `Email/set`, `Mailbox/set`, `Identity/set`, etc., to prevent lost updates.

8. **Implement `Email/copy` and `Email/import`** _(Necessary)_  
   Provide APIs for server-side duplication and ingest of new messages per the Mail capability.

9. **Wire `onSuccess*` backreferences** _(Necessary)_  
   Support `onSuccessDestroyOriginal`, `onSuccessUpdateEmail`, and related pipeline hooks so multi-step method calls behave correctly.

10. **Track Email change log entries fully** _(Necessary)_  
    Record mailbox membership, keyword, and thread state transitions for every create/update/destroy so `/changes` responses stay accurate.

11. **Implement `Email/query` operators** _(Necessary)_  
    Add the remaining filters (from, to, header, size, flags, date ranges), sort options, anchors, and `calculateChanges`.

12. **Expose EmailSubmission state endpoints** _(Necessary)_  
    Implement `EmailSubmission/get` and `/changes`, maintain a dedicated state counter, and emit delivery updates through these APIs.

13. **Honor `sendAt` and undo windows** _(Necessary)_  
    Queue submissions for future delivery, respect cancelation windows, and prevent immediate send when scheduling is requested.

14. **Add `onSuccessUpdateEmail` handling** _(Necessary)_  
    When submissions succeed, update the associated Email (keywords, mailbox membership) through the standard hook rather than bespoke logic.

15. **Implement Blob endpoints** _(Necessary)_  
    Add `Blob/get`, `Blob/copy`, `Blob/lookup`, and spec-compliant download token handling instead of the current custom upload-token flow.

16. **Provide push/eventing story** _(Optional)_  
    Implement `PushSubscription/*` and expose a non-null `eventSourceUrl` for RFC 8887 state change notifications.

17. **Extend inbound pipeline to multi-recipient** _(Necessary)_  
    Process every local recipient on an inbound message (To/Cc/Bcc, aliases), creating separate account message rows per address.

18. **Verify SES/SNS webhooks** _(Necessary)_  
    Validate AWS signatures, handle subscription confirmation, and drop unsigned payloads before mutating submission state.

19. **Enforce strong upload token policy** _(Necessary)_  
    Replace the bespoke `uploadToken` record with the JMAP upload semantics (per-account upload limit, auth checks, expiry) and ensure blobs can be referenced by any compliant client.

20. **Expose multi-account targeting** _(Optional)_  
    Update auth middleware to honor the `accountId` supplied by clients, enabling future multi-account or delegated mailbox scenarios.
