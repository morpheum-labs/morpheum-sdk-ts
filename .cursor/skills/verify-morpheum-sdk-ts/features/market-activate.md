# Activate a market

`encodeMsgActivateMarket` encodes `MsgActivateMarketRequest`. `buildMarketActivateSignDoc` builds a SignDoc from those bytes. An activation names market index `1`. `activator` is the signer address. That work stays on this machine.

## Sub-features

- `activate` encodes market index `1` and `activator` set to the signer address. The encoded message is non-empty.
- `sign` builds a SignDoc for that activation. `signDocBytes` is non-empty, and the body message type URL is `/market.v1.MsgActivateMarketRequest`.

## How to get to it (user POV)

- Import `encodeMsgActivateMarket` and `buildMarketActivateSignDoc` from `@morpheum/sdk`.
- Pass `activator` set to the signer address and `marketIndex` `1`. `marketIndex` is a number.
- Sign with `buildMarketActivateSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive market-activate
```

- **Encode an activation.** The command encodes `activator` equal to the signer address and `marketIndex` `1`. Decoding those bytes with `MsgActivateMarketRequest` records `observations.marketIndex` `"1"`, `observations.activator` equal to that address, `observations.timestamp` `null`, and `observations.msgByteLength` greater than 0.
- **Sign that activation.** `buildMarketActivateSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/market.v1.MsgActivateMarketRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import SDK calls from the public barrel only. Do not import `src/modules/market.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `marketIndex` decodes as a bigint. The observation records it as a decimal string.
- `activator` is the signer address. The message has no separate `fromAddress` field.
- The encoder does not set `timestamp`. The drive asserts the decoded field is unset and records `observations.timestamp` as `null`.
- The type URL is `/market.v1.MsgActivateMarketRequest`. The drive asserts that string exactly. It is not `/market.v1.Msg/ActivateMarket`.
- `encodeMsgActivateMarket` does not check that the market is pending. Do not invent a rejection the library does not perform.
