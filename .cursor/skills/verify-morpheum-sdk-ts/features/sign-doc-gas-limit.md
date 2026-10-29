# Declare a gas limit

`SignDocOptions.gasLimit` is passed through to the signing package. An omitted limit becomes that package's default. An invalid limit throws. The value that matters is the one inside the signed SignDoc preimage.

## Sub-features

- `gas-declared` signs `750000` from `buildSignDoc`.
- `gas-omitted` signs the signing package default, `25000`.
- `gas-rejected` throws when the limit is `0`.
- `gas-every-builder` runs `test/gas-limit.test.ts`, which calls every exported `build*SignDoc`.

## How to get to it (user POV)

- Import `buildSignDoc` or any `build*SignDoc` helper from `@morpheum/sdk`.
- Pass `options.gasLimit` when the message needs more than the default. Leave it out to take the signing package default.
- Read the limit back from the signed preimage before you broadcast. `buildSignedTx` ships the same `authInfoBytes`.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- No chain node is required.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive sign-doc-gas-limit
```

- **Declare a limit.** The command calls `buildSignDoc` with `gasLimit` `750000n` on a bucket-creation message. `observations.declared.gasLimit` is `"750000"` and `observations.declared.shipsTheSignedAuthInfo` is true.
- **Omit the limit.** The same call with `{}` records `observations.omitted.gasLimit` `"25000"` and `shipsTheSignedAuthInfo` true.
- **Reject zero.** The same call with `gasLimit` `0n` throws an error matching `invalid gasLimit`. `observations.invalidRejected` is true.
- **Cover every builder.** The command runs `node_modules/.bin/tsx --test test/gas-limit.test.ts`. `observations.gasLimitTestExit` is `0`. A builder missing from that file fails the test.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- Do not default, clamp, or validate `gasLimit` in this repo. The signing package is the only check. A second check here will drift.
- `25000` is the signing package default this SDK's test pins. If that package changes the default, this drive fails until the pin is updated there and the observation here is updated to match.
- Decode gas from `signDocBytes` via `SignDoc` and `AuthInfo`. The returned `authInfoBytes` must be those same bytes. Checking only the option you passed does not show that it was signed.
- `test/gas-limit.test.ts` fails when a new `build*SignDoc` export is missing from its table. Keep that failure. Do not drop the test run from this drive to make the script pass.
