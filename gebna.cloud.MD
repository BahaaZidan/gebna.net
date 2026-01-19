# Current Infrastructure Limitations

## Cloudflare R2

- No presigned flow in the RPC/built-in binding. (Have to use an AWS client)

## Cloudflare D1 (Retired in Favor of Turso)

- 10 GB size limit per database

## Cloudflare Queues

- No deduplication ID (like SQS FIFO’s `MessageDeduplicationId`)
