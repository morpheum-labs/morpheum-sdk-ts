# Trigger a liquidation

`encodeMsgTriggerLiquidation` encodes `MsgTriggerLiquidation`. `buildRiskTriggerLiquidationSignDoc` builds a SignDoc from those bytes. A trigger names market index `1` and bucket id `"7"`. The message has no `fromAddress` field. The SignDoc still uses the signer address. That work stays on this machine.

## Sub-features

- `trigger` encodes market index `1` and bucket id `"7"`. The encoded message is non-empty.
- `sign` builds a SignDoc for that trigger. `signDocBytes` is non-empty, and the body message type URL is `/risk.v1.MsgTriggerLiquidation`.

## How to get to it (user POV)

- Import `encodeMsgTriggerLiquidation` and `buildRiskTriggerLiquidationSignDoc` from `@morpheum/sdk`.
- Pass `marketIndex` `1` and `bucketId` `"7"`. An omitted `bucketId` still encodes `"0"`, a market-wide scan.
- Sign with `buildRiskTriggerLiquidationSignDoc` using those same params. The signer address is a SignDoc argument. The message does not carry it.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive risk-trigger-liquidation
```

- **Encode a trigger.** The command encodes `marketIndex` `1` and `bucketId` `"7"`. Decoding those bytes with `MsgTriggerLiquidation` records `observations.marketIndex` `"1"`, `observations.bucketId` `"7"`, and `observations.msgByteLength` greater than 0.
- **Sign that trigger.** `buildRiskTriggerLiquidationSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/risk.v1.MsgTriggerLiquidation`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import from the public barrel only. Do not import `src/modules/risk.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `MsgTriggerLiquidation` is permissionless. Any signer may request the scan. The message has no `fromAddress` field. The SignDoc still uses the signer address.
- `bucketId` is an optional string. Omitting it encodes `"0"`, which requests a market-wide scan rather than a single bucket.
- `marketIndex` and `bucketId` are encoded as `BigInt`. Pass `marketIndex` as a number. Pass `bucketId` as a decimal string when you set it.
- The message does not carry a mark price. The chain derives the mark price and logical timestamp from committed state. Do not invent a mark-price field the library does not set.
- This drive passes market index `1` and bucket id `"7"`. Both are non-zero `uint64` fields, so the encoded message is non-empty. Require `observations.msgByteLength` greater than 0.
- `encodeMsgTriggerLiquidation` does not check that a position exists. Do not invent a rejection the library does not perform.
