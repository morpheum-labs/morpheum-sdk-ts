# Amend a CLOB order

`encodeMsgModifyOrder` encodes `MsgModifyOrderRequest`. `buildClobModifyOrderSignDoc` builds a SignDoc from those bytes. An amend names the signer, a fixed order id, and a new price and quantity as whole decimal strings. An omitted `symbol` encodes as `""`.

## Sub-features

- `amend` encodes `fromAddress`, order id `"order-1"`, `newPrice` `"101"`, and `newQuantity` `"2"`, with `symbol` omitted.
- `sign` builds a SignDoc for that amend. `signDocBytes` is non-empty, and the body message type URL is `/clob.v1.MsgModifyOrderRequest`.

## How to get to it (user POV)

- Import `encodeMsgModifyOrder` and `buildClobModifyOrderSignDoc` from `@morpheum/sdk`.
- Pass `fromAddress`, a fixed `orderId` string, and whole decimal strings for `newPrice` and `newQuantity`. Omit `symbol` when the amend is not scoped to a symbol.
- Sign with `buildClobModifyOrderSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-modify-order
```

- **Encode an amend.** The command encodes `fromAddress`, `orderId` `"order-1"`, `newPrice` `"101"`, and `newQuantity` `"2"`, and omits `symbol`. Decoding those bytes with `MsgModifyOrderRequest` records `observations.orderId` `"order-1"`, `observations.address` equal to that `fromAddress`, `observations.newPrice` `"101"`, `observations.newQuantity` `"2"`, and `observations.symbol` `""`.
- **Sign that amend.** `buildClobModifyOrderSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/clob.v1.MsgModifyOrderRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import from the public barrel only. Do not import `src/modules/clob.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `encodeMsgModifyOrder` does not check that the order id exists, or that `newPrice` and `newQuantity` are whole numbers. Do not invent a rejection the library does not perform.
