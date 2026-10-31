# Place a CLOB order

`encodeMsgPlaceOrder` encodes `MsgPlaceOrderRequest`. `buildClobPlaceOrderSignDoc` builds a SignDoc from those bytes. A simple limit buy uses a whole-number price and quantity, `Side.BUY`, and `OrderType.LIMIT`.

## Sub-features

- `limit-buy` encodes market `0`, price `"100"`, quantity `"1"`, `Side.BUY`, and `OrderType.LIMIT`.
- `sign` builds a SignDoc for that order. `signDocBytes` is non-empty, and the body message type URL is `/clob.v1.MsgPlaceOrderRequest`.

## How to get to it (user POV)

- Import `encodeMsgPlaceOrder`, `buildClobPlaceOrderSignDoc`, `Side`, and `OrderType` from `@morpheum/sdk`.
- Pass `marketIndex` `0`, whole decimal strings for `price` and `quantity`, and `side` / `orderType` from `Side` and `OrderType`.
- Sign with `buildClobPlaceOrderSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-place-order
```

- **Encode a limit buy.** The command encodes market index `0`, price `"100"`, quantity `"1"`, `Side.BUY`, and `OrderType.LIMIT`. Decoding those bytes with `MsgPlaceOrderRequest` records `observations.price` `"100"`, `observations.quantity` `"1"`, `observations.side` `1` (`Side.BUY`), `observations.orderType` `1` (`OrderType.LIMIT`), and `observations.marketIndex` `"0"`.
- **Sign that order.** `buildClobPlaceOrderSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/clob.v1.MsgPlaceOrderRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import from the public barrel only. Do not import `src/modules/clob.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `encodeMsgPlaceOrder` does not check price or quantity shape. Do not invent a rejection the library does not perform.
