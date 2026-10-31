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

- [Assemble a signed transaction](./build-signed-tx.md) — **offline / proven**. Covers `buildSignedTx` shipping the signed body, auth info, and nonce. Evidence: `../evidence/build-signed-tx/proof.json` with `result` `PASS`.
- [Declare a gas limit](./sign-doc-gas-limit.md) — **offline / proven**. Covers `buildSignDoc` and every `build*SignDoc` export. Evidence: `../evidence/sign-doc-gas-limit/proof.json` with `result` `PASS`.
- [Create a market](./create-market-terms.md) — **offline / proven**. Covers `encodeMsgCreateMarket` and `buildMarketCreateSignDoc`. Evidence: `../evidence/create-market-terms/proof.json` with `result` `PASS`.
- [Place a CLOB order](./clob-place-order.md) — **offline / proven**. Covers `encodeMsgPlaceOrder` and `buildClobPlaceOrderSignDoc`. Evidence: `../evidence/clob-place-order/proof.json` with `result` `PASS`.
- [Cancel a CLOB order](./clob-cancel-order.md) — **offline / proven**. Covers `encodeMsgCancelOrder` and `buildClobCancelOrderSignDoc`. Evidence: `../evidence/clob-cancel-order/proof.json` with `result` `PASS`.
- [Amend a CLOB order](./clob-modify-order.md) — **offline / proven**. Covers `encodeMsgModifyOrder` and `buildClobModifyOrderSignDoc`. Evidence: `../evidence/clob-modify-order/proof.json` with `result` `PASS`.
- [Place a batch of CLOB orders](./clob-place-batch-orders.md) — **offline / proven**. Covers `encodeMsgPlaceBatchOrders` and `buildClobPlaceBatchOrdersSignDoc`. Evidence: `../evidence/clob-place-batch-orders/proof.json` with `result` `PASS`.
- [Provide a market-maker quote](./clob-provide-mm-quote.md) — **offline / proven**. Covers `encodeMsgProvideMarketMakerQuote` and `buildClobProvideMarketMakerQuoteSignDoc`. Evidence: `../evidence/clob-provide-mm-quote/proof.json` with `result` `PASS`.
- [Cancel a market-maker quote](./clob-cancel-mm-quote.md) — **offline / proven**. Covers `encodeMsgCancelMarketMakerQuote` and `buildClobCancelMarketMakerQuoteSignDoc`. Evidence: `../evidence/clob-cancel-mm-quote/proof.json` with `result` `PASS`.
- [Create a bucket](./bucket-create.md) — **offline / proven**. Covers `encodeMsgCreateBucket` and `buildBucketCreateSignDoc`. `build-signed-tx` still owns Tx assembly. Evidence: `../evidence/bucket-create/proof.json` with `result` `PASS`.
- [Close a position](./position-close.md) — **offline / proven**. Covers `encodeMsgClosePosition` and `buildPositionCloseSignDoc`. Evidence: `../evidence/position-close/proof.json` with `result` `PASS`.
- [Trigger a liquidation](./risk-trigger-liquidation.md) — **offline / proven**. Covers `encodeMsgTriggerLiquidation` and `buildRiskTriggerLiquidationSignDoc`. Evidence: `../evidence/risk-trigger-liquidation/proof.json` with `result` `PASS`.
- [Update position leverage](./position-update-leverage.md) — **offline / proven**. Covers `encodeMsgUpdatePositionLeverage` and `buildPositionUpdateLeverageSignDoc`. Evidence: `../evidence/position-update-leverage/proof.json` with `result` `PASS`.
- [Query over gRPC](./grpc-query-client.md) — **needs-sentry**. Covers `MormcoreGrpcClient` against a real node. Requires `MORPHEUM_GRPC_URL`. `UNMET` is not `PASS`. Do not fake a server.
- [Subscribe over WebSocket](./ws-stream.md) — **needs-sentry**. Covers `MorpheumWsClient` against a real stream. Requires `MORPHEUM_WS_URL`. `UNMET` is not `PASS`. Do not fake a server.

## Unmapped remaining

Still unmapped: the other bucket messages, transfer (`encodeMsgTransferBetweenBuckets` / `buildBucketTransferSignDoc`), transfer to bank (`encodeMsgTransferToBank` / `buildBucketTransferToBankSignDoc`), and set leverage (`encodeMsgSetLeverage` / `buildBucketSetLeverageSignDoc`).
