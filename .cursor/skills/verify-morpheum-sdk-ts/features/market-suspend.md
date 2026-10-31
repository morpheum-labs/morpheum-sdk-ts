# Suspend a market

`encodeMsgSuspendMarket` encodes `MsgSuspendMarketRequest`. `buildMarketSuspendSignDoc` builds a SignDoc from those bytes. A suspension names market index `1` and reason `"halt"`. `suspender` is the signer address. That work stays on this machine.

## Sub-features

- `suspend` encodes market index `1`, reason `"halt"`, and `suspender` set to the signer address. The encoded message is non-empty.
- `sign` builds a SignDoc for that suspension. `signDocBytes` is non-empty, and the body message type URL is `/market.v1.MsgSuspendMarketRequest`.

## How to get to it (user POV)

- Import `encodeMsgSuspendMarket` and `buildMarketSuspendSignDoc` from `@morpheum/sdk`.
- Pass `suspender` set to the signer address, `marketIndex` `1`, and `reason` `"halt"`. `marketIndex` is a number. `reason` is a non-empty string.
- Sign with `buildMarketSuspendSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive market-suspend
```

- **Encode a suspension.** The command encodes `suspender` equal to the signer address, `marketIndex` `1`, and `reason` `"halt"`. Decoding those bytes with `MsgSuspendMarketRequest` records `observations.marketIndex` `"1"`, `observations.reason` `"halt"`, `observations.suspender` equal to that address, `observations.timestamp` `null`, and `observations.msgByteLength` greater than 0.
- **Sign that suspension.** `buildMarketSuspendSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/market.v1.MsgSuspendMarketRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import SDK calls from the public barrel only. Do not import `src/modules/market.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `marketIndex` decodes as a bigint. The observation records it as a decimal string. `reason` stays a string.
- `suspender` is the signer address. The message has no separate `fromAddress` field.
- The encoder does not set `timestamp`. The drive asserts the decoded field is unset and records `observations.timestamp` as `null`.
- The type URL is `/market.v1.MsgSuspendMarketRequest`. The drive asserts that string exactly. It is not `/market.v1.Msg/SuspendMarket`.
- `encodeMsgSuspendMarket` does not check that the market is active. Do not invent a rejection the library does not perform.
