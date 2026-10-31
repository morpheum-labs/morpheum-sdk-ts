# Create a bucket

`encodeMsgCreateBucket` encodes `MsgCreateBucketRequest`. `buildBucketCreateSignDoc` builds a SignDoc from those bytes. A create names bucket id `"bucket-1"`, bucket type `1`, collateral asset index `0`, and initial margin `"100"`. `fromAddress` is the signer address. That work stays on this machine. `build-signed-tx` uses this message as a fixture for Tx assembly. This drive proves the message and SignDoc path.

## Sub-features

- `create` encodes bucket id `"bucket-1"`, bucket type `1`, collateral asset index `0`, initial margin `"100"`, and `fromAddress` set to the signer address.
- `sign` builds a SignDoc for that create. `signDocBytes` is non-empty, and the body message type URL is `/bucket.v1.MsgCreateBucketRequest`.

## How to get to it (user POV)

- Import `encodeMsgCreateBucket` and `buildBucketCreateSignDoc` from `@morpheum/sdk`.
- Pass `fromAddress`, `bucketId` `"bucket-1"`, `bucketType` `1`, `collateralAssetIndex` `0`, and `initialMargin` `"100"`.
- Sign with `buildBucketCreateSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive bucket-create
```

- **Encode a create.** The command encodes `fromAddress` equal to the signer address, `bucketId` `"bucket-1"`, `bucketType` `1`, `collateralAssetIndex` `0`, and `initialMargin` `"100"`. Decoding those bytes with `MsgCreateBucketRequest` records `observations.bucketId` `"bucket-1"`, `observations.bucketType` `1`, `observations.collateralAssetIndex` `"0"`, and `observations.initialMargin` `"100"`.
- **Sign that create.** `buildBucketCreateSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/bucket.v1.MsgCreateBucketRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- This drive proves the message and SignDoc path. `build-signed-tx` still owns Tx assembly and the signed-byte round-trip.
- Import from the public barrel only. Do not import `src/modules/bucket.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `fromAddress` is a param. The encoded message has no address field. Do not assert an address the schema does not carry.
- The encoder does not stamp `timestamp`. Do not assert a timestamp the library does not set.
- `encodeMsgCreateBucket` does not check that the bucket id is unused or that `initialMargin` is a whole number. Do not invent a rejection the library does not perform.
