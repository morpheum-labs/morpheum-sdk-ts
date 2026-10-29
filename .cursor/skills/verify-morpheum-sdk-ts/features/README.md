# morpheum-sdk-ts verification map

This directory is the maintained source for driving `@morpheum/sdk` the way a consumer does. Read this index, then use the feature file as the recipe.

The surface is a Node ESM library. There is no page, command palette, or long-lived process. Reaching a feature means importing it from `src/index.ts`.

## Baseline preconditions

- The checkout is this repo, `package.json` name `@morpheum/sdk`.
- `../morpheum-proto/ts` and `../morpheum-signing/crates/wasm/pkg-node` are the real packages named in `package.json`.
- `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh launch` has printed `verify-morpheum-sdk-ts ready`.
- `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh doctor` has printed `doctor ok`.
- Do not drive a `node_modules` tree that a launch is still installing.

## Driving conventions

- Start from the baseline above.
- Import the public barrel only. The drive script loads `src/index.ts`.
- Treat commands in the feature files as literal.
- One drive of a feature at a time. The proof path is shared.
- `RUN_ID` must match `[A-Za-z0-9._-]+`. Scratch is `/tmp/verify-morpheum-sdk-ts-$RUN_ID`.
- Cleanup removes scratch only. Leave `evidence/` in place.

## Proof and skip reporting

- Capture the call and the resulting bytes, error, or response. A process exit alone is not the proof.
- The proof file is `.cursor/skills/verify-morpheum-sdk-ts/evidence/<feature>/proof.json`.
- `result` must be `PASS`. `UNMET` means a required URL was unset. Do not report `UNMET` as verified.
- Do not report a skipped entry point as verified through a different feature.
- Network features fail closed without `MORPHEUM_GRPC_URL` or `MORPHEUM_WS_URL`. Do not add a fake server to flip that to a pass.

## Features

- [Assemble a signed transaction](./build-signed-tx.md) covers `buildSignedTx` shipping the signed body, auth info, and nonce.
- [Declare a gas limit](./sign-doc-gas-limit.md) covers `buildSignDoc` and every `build*SignDoc` export.
- [Create a market](./create-market-terms.md) covers `encodeMsgCreateMarket` and `buildMarketCreateSignDoc`.
- [Query over gRPC](./grpc-query-client.md) covers `MormcoreGrpcClient` against a real node.
- [Subscribe over WebSocket](./ws-stream.md) covers `MorpheumWsClient` against a real stream.
