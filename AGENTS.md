# Specialist brief

The public surface is `src/index.ts` only.

Market creation checks terms only in `encodeMsgCreateMarket`. `buildMarketCreateSignDoc` encodes through it. A CLOB market needs whole-number `tickSize` and `lotSize`. A market off the CLOB carries none of `tickSize`, `lotSize`, or `maxLeverage`.

That path is proven offline. Run `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive create-market-terms`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/create-market-terms/proof.json` with `"result": "PASS"`.

After create-market, the next HFT step is place order via `encodeMsgPlaceOrder` / `buildClobPlaceOrderSignDoc`. That path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-place-order`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/clob-place-order/proof.json` with `"result": "PASS"`.

After place order, cancel via `encodeMsgCancelOrder` / `buildClobCancelOrderSignDoc`. That path is proven offline by `bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-cancel-order`. Surviving evidence is `.cursor/skills/verify-morpheum-sdk-ts/evidence/clob-cancel-order/proof.json` with `"result": "PASS"`.

Re-drive from this checkout: `launch`, then `doctor`, then `drive clob-cancel-order`. The other offline drives are `build-signed-tx`, `sign-doc-gas-limit`, `create-market-terms`, and `clob-place-order`.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh launch
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh doctor
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive create-market-terms
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-place-order
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-cancel-order
```

`grpc-query-client` and `ws-stream` are **needs-sentry**. Hold them until a real `MORPHEUM_GRPC_URL` or `MORPHEUM_WS_URL` is set. An unset URL writes `"result": "UNMET"`. `UNMET` is not `PASS`. Do not fake a server.

Drive map: `.cursor/skills/verify-morpheum-sdk-ts/SKILL.md` and `.cursor/skills/verify-morpheum-sdk-ts/features/README.md`.
