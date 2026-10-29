# Assemble a signed transaction

`buildSignedTx` turns a SignDoc result and a signature into the `Tx` a caller submits. The `Tx` carries the `bodyBytes`, `authInfoBytes`, and `nonce` that were signed, including fields this SDK never sets.

## Sub-features

- `module-round-trip` builds a bucket-creation SignDoc and submits those bytes through `buildSignedTx`.
- `unknown-field` keeps a body field the current schema does not declare, plus memo, tx class, urgent, and gas limit.

## How to get to it (user POV)

- Import `buildBucketCreateSignDoc`, `encodeMsgCreateBucket`, and `buildSignedTx` from `@morpheum/sdk`.
- Build the SignDoc for `MsgCreateBucketRequest` with the signer, chain, and memo you intend to sign.
- Sign `signDocBytes` outside this SDK. Pass the SignDoc result and the signature to `buildSignedTx`.
- Submit the returned `Tx` with `MormcoreGrpcClient.submitTx` when a node is available. This drive stops at the assembled `Tx`.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The signing wasm package must be the real `pkg-node`.

Run this command once. Each bullet is a check that command records in `evidence/build-signed-tx/proof.json`.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive build-signed-tx
```

- **Round-trip a module SignDoc.** The command calls `buildBucketCreateSignDoc` for bucket `bucket-1` and `buildSignedTx` with a 65-byte signature. `observations.moduleRoundTrip` is true. The re-encoded body, auth info, and nonce equal the SignDoc fields, and the only message type URL is `/bucket.v1.MsgCreateBucketRequest`.
- **Keep an unknown field.** The command appends one unknown varint to a `TxBody` that also sets memo `memo`, tx class `2`, urgent `true`, and gas limit `25000`, then calls `buildSignedTx`. `observations.unknownFieldRoundTrip` is true. Re-encoding the assembled `Tx` reproduces those bytes.
- **Proof.** `proof.json` has `"result": "PASS"` and the transcript contains `PASS build-signed-tx`.

## Gotchas

- Rebuilding a `TxBody` or `AuthInfo` from message parts drops every field the rebuild does not set. Compare bytes. A populated `tx.body.memo` is not enough.
- `buildSignedTx` takes the SignDoc encodings. A call that passes a type URL and raw message bytes is the failure this drive exists to catch.
- The type pin on `buildSignedTx` reads only the last overload. A parts-based overload declared above it typechecks. This drive is the byte check.
- The unknown field number is one past the highest field in the checked-out `TxBody` schema. Do not hardcode a field number from memory.
