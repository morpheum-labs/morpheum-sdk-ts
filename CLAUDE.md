<!-- morpheum-workspace v2026-09-24 — shared blocks synced by sync.sh; edit prose freely -->
# morpheum-sdk-ts

The official TypeScript client SDK for the Morpheum L1 (`@morpheum/sdk`): typed tx
builders, canonical SignDoc construction via the signing wasm package, a Connect/gRPC query
client, and a WebSocket streaming client. ESM; `main`/`types` point at `src/` (consumers
compile it — there is currently no build step).

**This repo is PUBLIC on GitHub.** Everything committed here is public content.

## Layout

- `src/index.ts` — the entire public surface (barrel)
- `src/sign-doc.ts` — the single place this SDK touches signature coverage; wraps
  `buildSignDocBytes` from the signing wasm package and carries a type-level pin that
  `nonce` is required
- `src/tx-signed.ts` — `buildSignedTx`, the one place a signed `Tx` is assembled, from a
  SignDoc result and its signature
- `src/modules/` — per-module encode/SignDoc helpers; `src/ws/` — streaming client
- `src/grpc-client.ts` — Connect **node** transport (native gRPC/h2) — this SDK is
  Node-side; it cannot run in a browser as-is
- `test/` — `node:test` suites run through `tsx`; type-checked by the same `tsc` gate
  (`tsconfig.json` includes `test/`), never published (`files` is `src` only)

## Commands `[host]` (node/npm are host-only)

```bash
npm install
npx tsc --noEmit -p tsconfig.json    # type gate — covers src/ and test/
npm test                             # runtime gate — loads the real signing wasm package
```

## Invariants

- **Never re-derive signing bytes locally.** All SignDoc byte construction goes through
  the signing wasm package; this repo adds types and ergonomics only.
- **A signed `Tx` carries the encodings the signature covers.** `buildSignedTx` decodes
  `bodyBytes`, `authInfoBytes` and `nonce` from the SignDoc result; never rebuild a
  `TxBody` or `AuthInfo` from parts for submission — it drops every field the signer
  bound that the rebuild does not set. The `_SentTxIsTheSignedBytes` type pin keeps those
  encodings a required input; it cannot see whether they are actually used, and like the
  nonce pin it reads only the **last** overload, so a parts-based overload declared above
  the SignDoc one passes unseen. `test/tx-signed.test.ts` is what checks use: the
  assembled `Tx` must re-encode to exactly the signed bytes, including fields this SDK
  never sets and fields its schema does not know.
- The `nonce`-required type pin here is belt-and-braces, not the guard: `Parameters<T>`
  reads only the **last** overload, so a reintroduced duplicate declaration upstream is
  invisible from here. The authoritative pin lives in the signing repo; if types look
  wrong, fix there, not with a local override.
- `@bufbuild/protobuf` must resolve to a single version with `../morpheum-proto/ts` —
  check lockfiles when generated types disagree.
- Keep the public surface exported from `src/index.ts` only; no deep-path imports in docs
  or examples.
- `encodeMsgCreateMarket` is the one place a market creation's terms are checked, and
  `buildMarketCreateSignDoc` encodes through it: a market that trades on the CLOB needs
  whole-number `tickSize` and `lotSize` (an absent `maxLeverage` encodes as `""`, a 1x
  cap); a market off the CLOB carries none of the three. Never default a missing tick or
  lot on a CLOB market to `""` or a decimal; terms outside the accepted form must throw
  before a SignDoc is built.

<!-- framework:begin ripple -->
## Cross-repo ripple

- Depends on siblings: `@morpheum/proto` → `file:../morpheum-proto/ts`;
  `@morpheum/signing-node` → `file:../morpheum-signing/crates/wasm/pkg-node`.
- Dependents: `morpheum-consensus-demo` and `orchestrator/tests/e2e-web` (both `file:` deps).
- `@bufbuild/protobuf` must resolve to a single version across this package and
  `../morpheum-proto/ts`.
- Signing byte-layout questions belong upstream in `morpheum-signing` — this SDK must never
  re-derive preimage bytes locally.
<!-- framework:end ripple -->

## Verification

- Run both gates — `npx tsc --noEmit` and `npm test` — after every change, and after any
  rebuild of the signing `pkg-node` or proto `ts/` packages. The tests execute the
  `pkg-node` on disk, not signing `main`: a stale build gives a stale result.
- There is no CI for this repo yet: the signing `pkg-node` dependency is a gitignored
  `wasm-pack` build output, so a CI job would first have to build it from source. Say
  plainly in any PR which gates ran locally rather than implying CI did.
