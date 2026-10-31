# Update position leverage

`encodeMsgUpdatePositionLeverage` encodes `MsgUpdatePositionLeverage`. `buildPositionUpdateLeverageSignDoc` builds a SignDoc from those bytes. An update names market index `1`, new leverage `"5"`, position id `"3"`, and bucket id `"7"`. `fromAddress` is the signer address. That work stays on this machine.

## Sub-features

- `update` encodes market index `1`, new leverage `"5"`, position id `"3"`, bucket id `"7"`, and `fromAddress` set to the signer address. The encoded message is non-empty.
- `sign` builds a SignDoc for that update. `signDocBytes` is non-empty, and the body message type URL is `/position.v1.Msg/UpdatePositionLeverage`.

## How to get to it (user POV)

- Import `encodeMsgUpdatePositionLeverage` and `buildPositionUpdateLeverageSignDoc` from `@morpheum/sdk`.
- Pass `fromAddress`, `marketIndex` `1`, `newLeverage` `"5"`, `positionId` `"3"`, and `bucketId` `"7"`. `newLeverage`, `positionId`, and `bucketId` are strings. `marketIndex` is a number.
- Sign with `buildPositionUpdateLeverageSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive position-update-leverage
```

- **Encode an update.** The command encodes `fromAddress` equal to the signer address, `marketIndex` `1`, `newLeverage` `"5"`, `positionId` `"3"`, and `bucketId` `"7"`. Decoding those bytes with `MsgUpdatePositionLeverage` records `observations.address` equal to that `fromAddress`, `observations.positionId` `"3"`, `observations.bucketId` `"7"`, `observations.marketIndex` `"1"`, `observations.newLeverage` `"5"`, and `observations.msgByteLength` greater than 0.
- **Sign that update.** `buildPositionUpdateLeverageSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/position.v1.Msg/UpdatePositionLeverage`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import SDK calls from the public barrel only. Do not import `src/modules/position.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `positionId`, `bucketId`, and `newLeverage` are strings. `marketIndex` decodes as a bigint. `MsgClosePosition.bucketId` and `MsgTriggerLiquidation.bucketId` decode as bigints. This message's `bucketId` is a string.
- The encoder assigns `newLeverage` as given. It does not scale the string. `"5"` stays `"5"`.
- The encoder does not set `timestamp`. Do not assert one.
- Omitting `positionId` or `bucketId` encodes `""`. This drive sets both.
- The type URL is `/position.v1.Msg/UpdatePositionLeverage`. That is the `Msg` service and `UpdatePositionLeverage` method.
- `encodeMsgUpdatePositionLeverage` does not check that a position exists. Do not invent a rejection the library does not perform.
