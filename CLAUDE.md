<!-- morpheum-claude-framework v2026-08-07 — shared blocks synced by sync.sh; edit prose freely -->
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
- `src/modules/` — per-module encode/build helpers; `src/ws/` — streaming client
- `src/grpc-client.ts` — Connect **node** transport (native gRPC/h2) — this SDK is
  Node-side; it cannot run in a browser as-is

## Commands `[host]` (node/npm are host-only)

```bash
npm install
npx tsc --noEmit -p tsconfig.json    # THE gate — there is no test script or CI yet
```

## Invariants

- **Never re-derive signing bytes locally.** All SignDoc byte construction goes through
  the signing wasm package; this repo adds types and ergonomics only.
- The `nonce`-required type pin here is belt-and-braces, not the guard: `Parameters<T>`
  reads only the **last** overload, so a reintroduced duplicate declaration upstream is
  invisible from here. The authoritative pin lives in the signing repo; if types look
  wrong, fix there, not with a local override.
- `@bufbuild/protobuf` must resolve to a single version with `../morpheum-proto/ts` —
  check lockfiles when generated types disagree.
- Keep the public surface exported from `src/index.ts` only; no deep-path imports in docs
  or examples.

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

- `npx tsc --noEmit` is the only gate — run it after every change, and after any rebuild
  of the signing `pkg-node` or proto `ts/` packages. There is no CI and no test runner
  yet; say so plainly in any PR rather than implying a suite ran.
