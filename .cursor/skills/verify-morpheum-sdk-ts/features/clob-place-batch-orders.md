# Place a batch of CLOB orders

`encodeMsgPlaceBatchOrders` encodes `MsgPlaceBatchOrdersRequest`. `buildClobPlaceBatchOrdersSignDoc` builds a SignDoc from those bytes. A batch of limit orders uses whole-number prices and quantities, `Side`, and `OrderType`. When `ordersHash` is omitted, the encoder fills it. Each order's timestamp is the wall clock (`Date.now()/1000`). That work stays on this machine.

## Sub-features

- `batch` encodes two limit orders on market `0`. The first is price `"100"`, quantity `"1"`, `Side.BUY`, and `OrderType.LIMIT`. The second is price `"101"`, quantity `"2"`, `Side.SELL`, and `OrderType.LIMIT`. `ordersHash` is omitted.
- `sign` builds a SignDoc for that batch. `signDocBytes` is non-empty, and the body message type URL is `/clob.v1.MsgPlaceBatchOrdersRequest`.

## How to get to it (user POV)

- Import `encodeMsgPlaceBatchOrders`, `buildClobPlaceBatchOrdersSignDoc`, `Side`, and `OrderType` from `@morpheum/sdk`.
- Pass `fromAddress` and `orders`. Each order has `marketIndex` `0`, whole decimal strings for `price` and `quantity`, and `side` / `orderType` from `Side` and `OrderType`.
- Sign with `buildClobPlaceBatchOrdersSignDoc` using those same params.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-place-batch-orders
```

- **Encode a batch.** The command encodes `fromAddress` and the two limit orders above, and omits `ordersHash`. Decoding those bytes with `MsgPlaceBatchOrdersRequest` records `observations.orderCount` `2`, `observations.fromAddress` equal to that `fromAddress`, `observations.prices` `["100", "101"]`, `observations.quantities` `["1", "2"]`, `observations.sides` `[1, 2]` (`Side.BUY`, `Side.SELL`), `observations.orderTypes` `[1, 1]` (`OrderType.LIMIT`), `observations.firstPrice` `"100"`, `observations.firstQuantity` `"1"`, `observations.firstSide` `1`, and `observations.firstOrderType` `1`. `observations.ordersHash` is the hash string the library returned. `observations.ordersHashNonEmpty` is true. `observations.timestampSeconds` is the unix second the library stamped on both orders. The drive does not compare that second or that hash to a fixed value.
- **Sign that batch.** `buildClobPlaceBatchOrdersSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/clob.v1.MsgPlaceBatchOrdersRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import from the public barrel only. Do not import `src/modules/clob.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `encodeMsgPlaceBatchOrders` reads `Date.now()` on every call and may fill `ordersHash` with keccak256. Do not stub the clock. Do not assert a frozen timestamp or a frozen hash. Encode and the SignDoc are two calls; the drive keeps them in the same wall-clock second so the body bytes can match, then records the hash and timestamp the library returned.
- `encodeMsgPlaceBatchOrders` does not check that price or quantity are whole numbers, or that the batch is non-empty. Do not invent a rejection the library does not perform.
