---
name: verify-morpheum-sdk-ts
description: >-
  Launch, doctor, drive, and prove @morpheum/sdk, the Morpheum TypeScript
  library (Node ESM, no UI). Use when verifying this checkout the way a
  consumer imports src/index.ts, or when asked to drive SignDoc builders,
  buildSignedTx, market creation terms, CLOB place-order, MormcoreGrpcClient,
  or MorpheumWsClient.
---

# Verify morpheum-sdk-ts

`@morpheum/sdk` is a Node ESM library. Consumers import `src/index.ts`. There is no server, port, or UI. A drive is a short `tsx` process that imports that barrel and calls one exported feature.

Run every command from a checkout of this repo. The helper resolves the repo from its own path, so the shell cwd can be anywhere.

Sibling checkouts sit in the parent directory.

- `@morpheum/proto` is `../morpheum-proto/ts`
- `@morpheum/signing-node` is `../morpheum-signing/crates/wasm/pkg-node`

`morpheum-proto` is private. `morpheum-signing` is public. Building `pkg-node` also needs private siblings `morpheum-primitives` and `cryptogram` beside `morpheum-signing`. A git credential that cannot read those repos gets `Repository not found`. Do not invent substitute packages.

Two checkouts can be driven at the same time. One checkout has one `node_modules`. Do not run two launches against it at once. Do not run `doctor` or `drive` while a launch holds `/tmp/verify-morpheum-sdk-ts-launch.lock`. Run one drive of a given feature at a time. They share one proof file.

## Launch

Launch installs dependencies and imports the barrel. There is no process to leave running.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh launch
```

Launch does the following.

1. Clone `https://github.com/morpheum-labs/morpheum-proto.git` into `../morpheum-proto` when that directory is missing.
2. Clone `https://github.com/morpheum-labs/morpheum-signing.git` into `../morpheum-signing` when that directory is missing.
3. Require `../morpheum-proto/ts/package.json`.
4. When `pkg-node/package.json` is missing, require `../morpheum-primitives` and `../cryptogram`, require `wasm-pack` on `PATH`, and run this command in `../morpheum-signing`.

```bash
wasm-pack build crates/wasm --target nodejs --out-dir pkg-node
```

5. Run `npm ci --ignore-scripts` in `../morpheum-proto/ts`. Generated files import `@bufbuild/protobuf` from that package. Node and `tsc` resolve it there, not from this repo's `node_modules`.
6. Run `npm install` in this repo.
7. Import `./src/index.ts` with the local `tsx` and `--input-type=module`. `tsx --eval` compiles as CommonJS without that flag, so a top-level `await import` fails before the barrel loads. That load pulls in the real signing wasm.

Ready is this line on stdout.

```text
verify-morpheum-sdk-ts ready
```

A missing sibling, a missing `pkg-node`, or an import error means the checkout is not ready. Fix that before driving. Do not stub `@morpheum/proto` or `@morpheum/signing-node`.

Launch is safe to repeat. A second launch exits while the first still holds the lock. A lock whose pid is dead is removed and taken.

## Doctor

Doctor is read-only. Run it before a drive, and again whenever a drive looks wrong.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh doctor
```

It checks all of the following.

- Node is 20 or newer, and `package.json` names `@morpheum/sdk`.
- `../morpheum-proto/ts` names `@morpheum/proto`.
- `pkg-node` exists, `node_modules/@morpheum/signing-node` contains a `*_bg.wasm`, and that package mentions `buildSignDocBytes`.
- `node_modules/@morpheum/proto` is linked.
- `npm ls @bufbuild/protobuf --all` resolves to one version.
- Feature filenames under `features/` match `verify.sh features`.
- `npx tsc --noEmit -p tsconfig.json` passes. The binary used is `node_modules/.bin/tsc`.
- Whether `MORPHEUM_GRPC_URL`, `MORPHEUM_WS_URL`, and a global `WebSocket` are present. Unset URLs do not fail the doctor. They fail only the drives that need them.

The last line is `doctor ok` or `doctor fail`. Exit 0 means the offline features are worth driving. Exit 2 means a launch is still running.

## Drive

Import the public barrel only. The drive script loads `src/index.ts` by absolute path. Do not import `src/modules/*`, `src/ws/*`, or `src/sign-doc.ts` from a proof.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh features
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive <feature>
```

Feature ids are `build-signed-tx`, `sign-doc-gas-limit`, `create-market-terms`, `clob-place-order`, `grpc-query-client`, and `ws-stream`. The matching file in `features/` is the recipe. Run that file's checks. Do not mark a feature passed because a different feature passed.

`grpc-query-client` reads `MORPHEUM_GRPC_URL`. `ws-stream` reads `MORPHEUM_WS_URL`. When the variable is unset the drive exits 2 and writes `"result": "UNMET"`. That is not a pass. Do not point those drives at a stand-in server to make them pass.

`RUN_ID` selects the scratch directory `/tmp/verify-morpheum-sdk-ts-$RUN_ID`. It must match `[A-Za-z0-9._-]+`. When unset, the script uses a UTC timestamp.

The repo's full runtime gate is `npm test` (`tsx --test test/*.test.ts`). Use it after a signing or proto rebuild. A single feature drive does not replace it. `sign-doc-gas-limit` also runs `test/gas-limit.test.ts`, because that file is the list of every `build*SignDoc` export.

## Evidence

A drive writes two files that cleanup must leave in place.

- `.cursor/skills/verify-morpheum-sdk-ts/evidence/<feature>/proof.json`
- `.cursor/skills/verify-morpheum-sdk-ts/evidence/<feature>/transcript.txt`

`proof.json` records `feature`, `result`, `command`, `runId`, `repoHead`, `finishedAt`, and `observations`. A feature is proved only when `result` is `PASS`. `FAIL` and `UNMET` are not passes.

The proof has to show the call and the resulting state. For `build-signed-tx`, that state is the re-encoded `bodyBytes`, `authInfoBytes`, and `nonce` matching the bytes the signature covers, including a field the schema does not know. For `sign-doc-gas-limit`, it is the gas limit decoded from the SignDoc preimage. For `create-market-terms`, it is the decoded `MsgCreateMarketRequest` plus the thrown errors. For `clob-place-order`, it is the decoded `MsgPlaceOrderRequest` (price, quantity, side, orderType, marketIndex) and a SignDoc whose body message type URL is `/clob.v1.MsgPlaceOrderRequest`. For the network features, it is the RPC or subscription result from the URL you set, not a constructed object.

Stdout of a passing drive includes a `PASS <feature>` line and `evidence-sha256` of `proof.json`.

`features/README.md` is the scan. `build-signed-tx`, `sign-doc-gas-limit`, `create-market-terms`, and `clob-place-order` are offline / proven. `grpc-query-client` and `ws-stream` are needs-sentry.

## Cleanup

Cleanup deletes scratch directories and a stale launch lock. It does not delete `evidence/`.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh cleanup "$RUN_ID"
```

With no id, it removes every `/tmp/verify-morpheum-sdk-ts-*` directory. It refuses any path outside that prefix. It does not kill processes by name. A live launch keeps its lock.

After cleanup, `proof.json` for the drive you ran must still be on disk. A cleanup that removes it is a bug in this skill.

Run cleanup after a failed drive too, so scratch directories do not pile up.

## Helpers

`scripts/verify.sh` is the command. It is executable. It calls `scripts/drive.ts` through `node_modules/.bin/tsx`.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh launch
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh doctor
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh features
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive build-signed-tx
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh cleanup "$RUN_ID"
```

`drive.ts --list` prints feature ids. Use it only through `verify.sh features`, so the repo's `tsx` is the loader.

When the library changes, run `/maintain-verification-skill` on this skill so `features/` stays aligned with `src/index.ts`.
