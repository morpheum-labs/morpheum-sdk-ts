# Transfer to bank

`encodeMsgTransferToBank` encodes `MsgTransferToBankRequest`. `buildBucketTransferToBankSignDoc` builds a SignDoc from those bytes. A withdrawal names bucket `"7"`, asset index `3`, and amount `"1000"`. `fromAddress` is the signer address. That work stays on this machine.

## Sub-features

- `withdraw` encodes bucket `"7"`, asset index `3`, amount `"1000"`, and `fromAddress` set to the signer address. The encoded message is non-empty.
- `sign` builds a SignDoc for that withdrawal. `signDocBytes` is non-empty, and the body message type URL is `/bucket.v1.MsgTransferToBankRequest`.

## How to get to it (user POV)

- Import `encodeMsgTransferToBank` and `buildBucketTransferToBankSignDoc` from `@morpheum/sdk`.
- Pass `fromAddress`, `bucketId` `"7"`, `assetIndex` `3`, and `amount` `"1000"`. `assetIndex` is a number.
- Sign with `buildBucketTransferToBankSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive bucket-transfer-to-bank
```

- **Encode a withdrawal.** The command encodes `fromAddress` equal to the signer address, `bucketId` `"7"`, `assetIndex` `3`, and `amount` `"1000"`. Decoding those bytes with `MsgTransferToBankRequest` records `observations.bucketId` `"7"`, `observations.assetIndex` `"3"`, `observations.amount` `"1000"`, and `observations.msgByteLength` greater than 0.
- **Sign that withdrawal.** `buildBucketTransferToBankSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/bucket.v1.MsgTransferToBankRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import SDK calls from the public barrel only. Do not import `src/modules/bucket.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `fromAddress` is a param. Fields `address` and `from_address` are reserved. The encoded message has no address field. Do not assert an address the schema does not carry.
- `assetIndex` decodes as a bigint. The observation records it as a decimal string.
- The type URL is `/bucket.v1.MsgTransferToBankRequest`. That string is dot form. It does not contain `/Msg/`.
- The encoder does not stamp `timestamp`. Do not assert a timestamp the library does not set.
- `encodeMsgTransferToBank` does not check that the bucket holds the asset. Do not invent a rejection the library does not perform.
