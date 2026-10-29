# Query over gRPC

`MormcoreGrpcClient` is the Connect client for a Mormcore sentry. It uses the Node gRPC transport. Callers construct it with a base URL and call a query method.

## Sub-features

- `query-latest-tips` calls `queryLatestTips` and records the response keys.
- `close-client` calls `close()` after the query.

## How to get to it (user POV)

- Import `MormcoreGrpcClient` from `@morpheum/sdk`.
- Construct it with the sentry base URL you were given.
- Call `queryLatestTips` for a read-only liveness check.
- Call `close()` when the process is done with the client.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- `MORPHEUM_GRPC_URL` is the `baseUrl` of a Mormcore sentry this credential can query.
- When `MORPHEUM_GRPC_URL` is unset, the drive exits 2 and writes `"result": "UNMET"`. Do not treat that as a pass, and do not replace the sentry with an in-process fake.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive grpc-query-client
```

Export `MORPHEUM_GRPC_URL` to the sentry base URL before that command.

- **Query tips.** The command constructs `MormcoreGrpcClient` with `MORPHEUM_GRPC_URL` and calls `queryLatestTips`. The call resolves within 20 seconds. `observations.method` is `"queryLatestTips"` and `observations.responseKeys` lists the response fields.
- **Close.** The command calls `close()`. There is no socket handle to observe. The query result is the proof.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- The client cannot run in a browser. The transport is `@connectrpc/connect-node`.
- An unset URL is an unmet precondition. A doctor line that says the URL is unset is not a successful query.
- `pollUntil*` methods wait up to `CONSENSUS_POLL_TIMEOUT_MS` (30000) for chain state. Do not use them as the liveness check. They need a market, bucket, order, or position that already exists.
- `close()` does not tear down a connection. Connect transports are stateless. Do not require a closed socket as proof.
- Do not take `chainId` or `genesisHash` from this node and then sign with them. Chain identity comes from operator configuration.
