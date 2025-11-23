## Compliance
- Generate and return a server-controlled `verificationCode` during `PushSubscription/set` create operations (and clear it on successful verification) instead of trusting a client-provided value; RFC 8620 expects the server to issue this challenge (`apps/backend/src/lib/jmap/method-handlers/push-subscription-set.ts`, push delivery handler TBD).
