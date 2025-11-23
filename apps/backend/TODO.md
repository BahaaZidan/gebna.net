## Compliance

- Make `PushSubscription/set` handle destroy operations and remove the non-standard `PushSubscription/destroy` method so the API matches RFC 8620 (`apps/backend/src/lib/jmap/method-handlers/push-subscription-set.ts`, `apps/backend/src/lib/jmap/method-handlers/push-subscription-destroy.ts`, `apps/backend/src/jmap.routes.ts`).
- Add `ifInState` handling to `PushSubscription/set` so clients can detect concurrent edits before mutating subscriptions (`apps/backend/src/lib/jmap/method-handlers/push-subscription-set.ts`).
- Persist mailbox query state (filter + sort) the same way `Email/query` does so `Mailbox/queryChanges` can validate incoming requests rather than assuming the token is just the mailbox state (`apps/backend/src/lib/jmap/method-handlers/mailbox-query.ts`, `apps/backend/src/lib/jmap/method-handlers/mailbox-query-changes.ts`).
- `Mailbox/queryChanges` always reports newly added ids with `index: 0`; compute the real index in the sorted result set so clients can insert items at the correct position (`apps/backend/src/lib/jmap/method-handlers/mailbox-query-changes.ts`).
