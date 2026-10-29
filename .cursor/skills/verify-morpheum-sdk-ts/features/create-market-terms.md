# Create a market

`encodeMsgCreateMarket` checks a creation's terms before anything is signed. `buildMarketCreateSignDoc` encodes through it. A CLOB market needs whole-number `tickSize` and `lotSize`. A market off the CLOB carries neither those nor `maxLeverage`.

## Sub-features

- `clob-terms` encodes a spot market on `clob` with tick `1` and lot `1`. An omitted `maxLeverage` encodes as `""`.
- `clob-sign` builds a SignDoc for that market.
- `reject-bad-terms` throws on a decimal tick, an empty `minOrderSize`, a non-CLOB order book for a spot market, and CLOB terms on a prediction market that is off the CLOB.

## How to get to it (user POV)

- Import `encodeMsgCreateMarket`, `buildMarketCreateSignDoc`, `CLOB_ORDERBOOK`, and `MarketType` from `@morpheum/sdk`.
- For a spot, perp, future, or option market, set `orderbookType` to `CLOB_ORDERBOOK` (`"clob"`) and pass whole-number `tickSize` and `lotSize`.
- For a prediction market on some other order book, omit `tickSize`, `lotSize`, and `maxLeverage`.
- Sign with `buildMarketCreateSignDoc` only after encode would accept the terms.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The happy-path SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive create-market-terms
```

- **Encode a CLOB spot market.** The command encodes base asset `1`, quote asset `0`, `minOrderSize` `"1"`, `tickSize` `"1"`, `lotSize` `"1"`. `observations.clobTickSize` is `"1"`, `observations.clobLotSize` is `"1"`, and `observations.clobMaxLeverage` is `""`.
- **Sign that market.** `buildMarketCreateSignDoc` returns a non-empty `signDocBytes`. `observations.signDocByteLength` is greater than 0.
- **Reject a decimal tick.** `tickSize` `"0.01"` throws from `encodeMsgCreateMarket` and from `buildMarketCreateSignDoc`. `observations.decimalTickRejected` and `observations.signDocRefusedDecimalTick` are true.
- **Reject the other illegal shapes.** An empty `minOrderSize` throws `minOrderSize is required`. A spot market with `orderbookType` `"amm"` throws an `orderbookType` error. A prediction market on `"amm"` encodes empty `tickSize`, `lotSize`, and `maxLeverage` (`observations.offClobTickSize` is `""`). The same prediction market with tick and lot set throws `does not trade on the CLOB`.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Do not default a missing tick or lot on a CLOB market to `""` or to a decimal such as `"0.01"`. The drive treats those as failures.
- Omitted `maxLeverage` encodes as `""`, which is a 1x cap. Do not send `"1"` unless that is the value you mean.
- Whole numbers are decimal digits only. `"+5"`, `"1e3"`, and `"1.0"` throw.
- Spot, perp, future, and option markets must use `orderbookType` `"clob"`. A prediction market may use another order book, and then it must not carry CLOB terms.
- The throw happens inside `encodeMsgCreateMarket`, before the signing package runs. A SignDoc for a rejected market is a bug.
