# Cancel a market-maker quote

`encodeMsgCancelMarketMakerQuote` encodes `MsgCancelMarketMakerQuoteRequest`. `buildClobCancelMarketMakerQuoteSignDoc` builds a SignDoc from those bytes. A cancel names a quote id and the provider. The provider can be the signer address. That work stays on this machine.

## Sub-features

- `cancel` encodes quote id `"quote-1"` and `provider` set to the signer address.
- `sign` builds a SignDoc for that cancel. `signDocBytes` is non-empty, and the body message type URL is `/clob.v1.MsgCancelMarketMakerQuoteRequest`.

## How to get to it (user POV)

- Import `encodeMsgCancelMarketMakerQuote` and `buildClobCancelMarketMakerQuoteSignDoc` from `@morpheum/sdk`.
- Pass `quoteId` and `provider` strings. The provider can be the signer address.
- Sign with `buildClobCancelMarketMakerQuoteSignDoc` using those same params. The signer address can be the provider address.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required. The SignDoc uses the real signing wasm.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive clob-cancel-mm-quote
```

- **Encode a cancel.** The command encodes `quoteId` `"quote-1"` and `provider` equal to the signer address. Decoding those bytes with `MsgCancelMarketMakerQuoteRequest` records `observations.quoteId` `"quote-1"` and `observations.provider` equal to that `provider`.
- **Sign that cancel.** `buildClobCancelMarketMakerQuoteSignDoc` returns a non-empty `signDocBytes`. The signed body has one message, type URL `/clob.v1.MsgCancelMarketMakerQuoteRequest`, whose value is the encoded bytes. `observations.typeUrl` is that URL. `observations.signDocByteLength` is greater than 0. `observations.bodyMatchesEncoded` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Import from the public barrel only. Do not import `src/modules/clob.ts`.
- No chain node is required. Do not point this drive at a stand-in server.
- `encodeMsgCancelMarketMakerQuote` does not check that the quote id exists. Do not invent a rejection the library does not perform.
- The encoder does not stamp `timestamp`. Do not assert a timestamp the library does not set.
