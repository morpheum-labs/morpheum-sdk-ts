# Set bucket leverage

`encodeMsgSetLeverage` encodes `MsgSetLeverage`. `buildBucketSetLeverageSignDoc` builds a SignDoc from those bytes. A setting names bucket `"7"`, market index `1`, and leverage `5`. `fromAddress` is the signer address. That work stays on this machine.

## Sub-features

- `set` encodes bucket `"7"`, market index `1`, leverage `5`, and `fromAddress` set to the signer address. The encoded message is non-empty.
- `sign` builds a SignDoc for that setting. `signDocBytes` is non-empty, and the body message type URL is `/bucket.v1.MsgSetLeverage`.

## How to get to it (user POV)

- Import `encodeMsgSetLeverage` and `buildBucketSetLeverageSignDoc` from `@morpheum/sdk`.
- Pass `fromAddress`, `bucketId` `"7"`, `marketIndex` `1`, and `leverage` `5`. `marketIndex` and `leverage` are numbers.
- Sign with `buildBucketSetLeverageSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive bucket-set-leverage
```

- **Encode a setting.** The command encodes `fromAddress` equal to the signer address, `bucketId` `"7"`, `marketIndex` `1`, and `leverage` `5`. Decoding those bytes with `MsgSetLeverage` records `observations.bucketId` `"7"`, `observations.marketIndex` `"1"`, `observations.leverage` `5`, and `observations.msgByteLength` greater than 0.
- **Sign that setting.** `buildBucketSetLeverageSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/bucket.v1.MsgSetLeverage`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import SDK calls from the public barrel only. Do not import `src/modules/bucket.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `fromAddress` is a param. Field 1 `signer` is reserved. The encoded message has no address field. Do not assert an address the schema does not carry.
- `marketIndex` decodes as a bigint. The observation records it as a decimal string. `leverage` stays a number.
- The type URL is `/bucket.v1.MsgSetLeverage`. The drive asserts that string exactly.
- `encodeMsgSetLeverage` does not cap leverage at a market maximum. Do not invent a rejection the library does not perform.
