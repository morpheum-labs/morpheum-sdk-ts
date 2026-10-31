# Cancel a CLOB order

`encodeMsgCancelOrder` encodes `MsgCancelOrderRequest`. `buildClobCancelOrderSignDoc` builds a SignDoc from those bytes. A cancel names the signer and a fixed order id. An omitted `symbol` encodes as `""`.

## Sub-features

- `cancel` encodes `fromAddress` and order id `"order-1"`, with `symbol` omitted.
- `sign` builds a SignDoc for that cancel. `signDocBytes` is non-empty, and the body message type URL is `/clob.v1.MsgCancelOrderRequest`.

## How to get to it (user POV)

- Import `encodeMsgCancelOrder` and `buildClobCancelOrderSignDoc` from `@morpheum/sdk`.
- Pass `fromAddress` and a fixed `orderId` string. Omit `symbol` when the cancel is not scoped to a symbol.
- Sign with `buildClobCancelOrderSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-cancel-order
```

- **Encode a cancel.** The command encodes `fromAddress` and `orderId` `"order-1"`, and omits `symbol`. Decoding those bytes with `MsgCancelOrderRequest` records `observations.orderId` `"order-1"`, `observations.address` equal to that `fromAddress`, and `observations.symbol` `""`.
- **Sign that cancel.** `buildClobCancelOrderSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/clob.v1.MsgCancelOrderRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import from the public barrel only. Do not import `src/modules/clob.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `encodeMsgCancelOrder` does not check that the order id exists or that `symbol` is set. Do not invent a rejection the library does not perform.
