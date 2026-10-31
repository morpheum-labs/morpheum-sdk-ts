# Transfer between buckets

`encodeMsgTransferBetweenBuckets` encodes `MsgTransferBetweenBucketsRequest`. `buildBucketTransferSignDoc` builds a SignDoc from those bytes. A transfer names source bucket `"7"`, target bucket `"9"`, amount `"1000"`, and reason `"rebalance"`. `fromAddress` is the signer address. That work stays on this machine.

## Sub-features

- `transfer` encodes source bucket `"7"`, target bucket `"9"`, amount `"1000"`, reason `"rebalance"`, and `fromAddress` set to the signer address. The encoded message is non-empty.
- `sign` builds a SignDoc for that transfer. `signDocBytes` is non-empty, and the body message type URL is `/bucket.v1.MsgTransferBetweenBucketsRequest`.

## How to get to it (user POV)

- Import `encodeMsgTransferBetweenBuckets` and `buildBucketTransferSignDoc` from `@morpheum/sdk`.
- Pass `fromAddress`, `sourceBucketId` `"7"`, `targetBucketId` `"9"`, `amount` `"1000"`, and `reason` `"rebalance"`.
- Sign with `buildBucketTransferSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive bucket-transfer-between-buckets
```

- **Encode a transfer.** The command encodes `fromAddress` equal to the signer address, `sourceBucketId` `"7"`, `targetBucketId` `"9"`, `amount` `"1000"`, and `reason` `"rebalance"`. Decoding those bytes with `MsgTransferBetweenBucketsRequest` records `observations.sourceBucketId` `"7"`, `observations.targetBucketId` `"9"`, `observations.amount` `"1000"`, `observations.reason` `"rebalance"`, and `observations.msgByteLength` greater than 0.
- **Sign that transfer.** `buildBucketTransferSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/bucket.v1.MsgTransferBetweenBucketsRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import SDK calls from the public barrel only. Do not import `src/modules/bucket.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `fromAddress` is a param. Field 1 `address` is reserved. The encoded message has no address field. Do not assert an address the schema does not carry.
- The type URL is `/bucket.v1.MsgTransferBetweenBucketsRequest`. That string is dot form. It does not contain `/Msg/`.
- The encoder does not stamp `timestamp`. Do not assert a timestamp the library does not set.
- Omitting `reason` encodes `""`. This drive sets `"rebalance"`.
- `encodeMsgTransferBetweenBuckets` does not check that either bucket exists. Do not invent a rejection the library does not perform.
