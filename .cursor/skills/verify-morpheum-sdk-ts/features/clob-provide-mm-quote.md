# Provide a market-maker quote

`encodeMsgProvideMarketMakerQuote` encodes `MsgProvideMarketMakerQuoteRequest`. `buildClobProvideMarketMakerQuoteSignDoc` builds a SignDoc from those bytes. A quote names the provider and a pool, market `0`, `Side.BUY`, and whole-number `price` and `amount` strings. `durationSeconds` sets the quote TTL. That work stays on this machine.

## Sub-features

- `quote` encodes `provider`, pool id `"pool-1"`, market `0`, `Side.BUY`, price `"100"`, amount `"1"`, and `durationSeconds` `60`.
- `sign` builds a SignDoc for that quote. `signDocBytes` is non-empty, and the body message type URL is `/clob.v1.MsgProvideMarketMakerQuoteRequest`.

## How to get to it (user POV)

- Import `encodeMsgProvideMarketMakerQuote`, `buildClobProvideMarketMakerQuoteSignDoc`, and `Side` from `@morpheum/sdk`.
- Pass `provider` and `poolId` strings, `marketIndex` `0`, `side` from `Side` (`BUY` or `SELL`), and whole decimal strings for `price` and `amount`. Pass `durationSeconds` when the quote has a TTL.
- Sign with `buildClobProvideMarketMakerQuoteSignDoc` using those same params. The signer address can be the provider address.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-provide-mm-quote
```

- **Encode a quote.** The command encodes `provider`, `poolId` `"pool-1"`, market index `0`, `Side.BUY`, price `"100"`, amount `"1"`, and `durationSeconds` `60`. Decoding those bytes with `MsgProvideMarketMakerQuoteRequest` records `observations.provider` equal to that `provider`, `observations.poolId` `"pool-1"`, `observations.marketIndex` `"0"`, `observations.side` `1` (`Side.BUY`), `observations.price` `"100"`, `observations.amount` `"1"`, and `observations.durationSeconds` `"60"`.
- **Sign that quote.** `buildClobProvideMarketMakerQuoteSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/clob.v1.MsgProvideMarketMakerQuoteRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import from the public barrel only. Do not import `src/modules/clob.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `encodeMsgProvideMarketMakerQuote` does not check that price or amount are whole numbers, or that the pool exists. Do not invent a rejection the library does not perform.
- The encoder does not stamp `timestamp`. Do not assert a timestamp the library does not set. `durationSeconds` is optional; this drive passes `60`, and an omitted duration is also valid.
