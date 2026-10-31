# Close a position

`encodeMsgClosePosition` encodes `MsgClosePosition`. `buildPositionCloseSignDoc` builds a SignDoc from those bytes. A close names market index `0` and exit price `"100"`. `fromAddress` is the signer address. An omitted `bucketId` encodes as `0`. That work stays on this machine.

## Sub-features

- `close` encodes market index `0`, exit price `"100"`, and `fromAddress` set to the signer address. `bucketId` is omitted.
- `sign` builds a SignDoc for that close. `signDocBytes` is non-empty, and the body message type URL is `/position.v1.Msg/ClosePosition`.

## How to get to it (user POV)

- Import `encodeMsgClosePosition` and `buildPositionCloseSignDoc` from `@morpheum/sdk`.
- Pass `fromAddress`, `marketIndex` `0`, and a whole-integer `exitPrice` string such as `"100"`. Omit `bucketId` to use the default `0`, or pass a number.
- Sign with `buildPositionCloseSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive position-close
```

- **Encode a close.** The command encodes `fromAddress` equal to the signer address, `marketIndex` `0`, and `exitPrice` `"100"`, and omits `bucketId`. Decoding those bytes with `MsgClosePosition` records `observations.address` equal to that `fromAddress`, `observations.marketIndex` `"0"`, `observations.exitPrice` `"100"`, and `observations.bucketId` `"0"`.
- **Sign that close.** `buildPositionCloseSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/position.v1.Msg/ClosePosition`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import from the public barrel only. Do not import `src/modules/position.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `exitPrice` is encoded with `BigInt(params.exitPrice)`. Pass a whole-integer string such as `"100"`. A decimal string is not a valid `BigInt` argument.
- The type URL is `/position.v1.Msg/ClosePosition`. That is the `Msg` service and `ClosePosition` method, not a `MsgClosePositionRequest` name.
- `bucketId` is an optional number. Omitting it encodes `0`. Do not pass a string.
- `encodeMsgClosePosition` does not check that a position exists. Do not invent a rejection the library does not perform.
