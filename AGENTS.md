# Specialist brief

The public surface is `src/index.ts` only.

Market creation checks terms only in `encodeMsgCreateMarket`. `buildMarketCreateSignDoc` encodes through it. A CLOB market needs whole-number `tickSize` and `lotSize`. A market off the CLOB carries none of `tickSize`, `lotSize`, or `maxLeverage`.

That path is proven offline. Run `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive create-market-terms`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/create-market-terms/proof.json` with `"result": "PASS"`.

After create-market, the next HFT step is place order via `encodeMsgPlaceOrder` / `buildClobPlaceOrderSignDoc`. That path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-place-order`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/clob-place-order/proof.json` with `"result": "PASS"`.

After place order, cancel via `encodeMsgCancelOrder` / `buildClobCancelOrderSignDoc`. That path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-cancel-order`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/clob-cancel-order/proof.json` with `"result": "PASS"`.

After cancel, amend via `encodeMsgModifyOrder` / `buildClobModifyOrderSignDoc`. That path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-modify-order`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/clob-modify-order/proof.json` with `"result": "PASS"`.

After amend, batch place via `encodeMsgPlaceBatchOrders` / `buildClobPlaceBatchOrdersSignDoc`. That path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-place-batch-orders`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/clob-place-batch-orders/proof.json` with `"result": "PASS"`.

After batch place, a market-maker quote via `encodeMsgProvideMarketMakerQuote` / `buildClobProvideMarketMakerQuoteSignDoc`. That path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-provide-mm-quote`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/clob-provide-mm-quote/proof.json` with `"result": "PASS"`.

After a market-maker quote, cancel that quote via `encodeMsgCancelMarketMakerQuote` / `buildClobCancelMarketMakerQuoteSignDoc`. That path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-cancel-mm-quote`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/clob-cancel-mm-quote/proof.json` with `"result": "PASS"`.

Bucket create via `encodeMsgCreateBucket` / `buildBucketCreateSignDoc` is a dedicated offline path. `build-signed-tx` still owns the Tx round-trip that uses a bucket-creation fixture. This path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive bucket-create`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/bucket-create/proof.json` with `"result": "PASS"`.

Close a position via `encodeMsgClosePosition` / `buildPositionCloseSignDoc`. That path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive position-close`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/position-close/proof.json` with `"result": "PASS"`.

Trigger a liquidation via `encodeMsgTriggerLiquidation` / `buildRiskTriggerLiquidationSignDoc`. That path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive risk-trigger-liquidation`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/risk-trigger-liquidation/proof.json` with `"result": "PASS"`.

Re-drive from this checkout: `launch`, then `doctor`, then `drive risk-trigger-liquidation`. The other offline drives are `build-signed-tx`, `sign-doc-gas-limit`, `create-market-terms`, `clob-place-order`, `clob-cancel-order`, `clob-modify-order`, `clob-place-batch-orders`, `clob-provide-mm-quote`, `clob-cancel-mm-quote`, `bucket-create`, and `position-close`.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh launch
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh doctor
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive create-market-terms
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-place-order
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-cancel-order
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-modify-order
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-place-batch-orders
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-provide-mm-quote
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-cancel-mm-quote
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive bucket-create
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive position-close
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive risk-trigger-liquidation
```

`grpc-query-client` and `ws-stream` are **needs-sentry**. Hold them until a real `MORPHEUM_GRPC_URL` or `MORPHEUM_WS_URL` is set. An unset URL writes `"result": "UNMET"`. `UNMET` is not `PASS`. Do not fake a server.

Drive map: `.cursor/skills/verify-morpheum-sdk-ts/SKILL.md` and `.cursor/skills/verify-morpheum-sdk-ts/features/README.md`.
