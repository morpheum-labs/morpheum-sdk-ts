/**
 * Assembles a complete Tx proto object for gRPC submission via IngressService/SubmitTx.
 *
 * A signed transaction is assembled from the encodings its signature covers —
 * the `bodyBytes`, `authInfoBytes` and `nonce` a SignDoc builder returned —
 * and never re-encoded from the parts they were built from. The verifier
 * rebuilds the preimage from the `TxBody` and `AuthInfo` it receives, so the
 * only transaction that verifies is the one carrying exactly the values that
 * were signed. Copying them is what keeps every field the signer bound on the
 * wire, including any this SDK never sets itself.
 */
import { create, fromBinary } from "@bufbuild/protobuf";
import {
  TxSchema,
  TxBodySchema,
  AuthInfoSchema,
  NonceSchema,
  type Tx,
} from "@morpheum/proto/tx/v1/tx_pb";
import type { SignDocResult } from "./sign-doc";
import type { Assert } from "./utils/type-assert";

/**
 * Assembles the signed transaction from the SignDoc its signature covers.
 *
 * `signDoc` is the result of `buildSignDoc` or of any module `build*SignDoc`
 * builder, and `signature` is the signature over that SignDoc. The body, auth
 * info and nonce are decoded from the signed encodings rather than
 * reconstructed, so the transaction cannot carry a value the signature does
 * not cover.
 */
export function buildSignedTx(
  signDoc: Pick<SignDocResult, "bodyBytes" | "authInfoBytes" | "nonce">,
  signature: Uint8Array,
): Tx {
  return create(TxSchema, {
    body: fromBinary(TxBodySchema, signDoc.bodyBytes),
    authInfo: fromBinary(AuthInfoSchema, signDoc.authInfoBytes),
    signatures: [signature],
    nonce: fromBinary(NonceSchema, signDoc.nonce),
  });
}

/**
 * Pins that **the signed encodings are a required input**: whatever
 * {@link buildSignedTx} accepts must carry `bodyBytes`, `authInfoBytes` and
 * `nonce` as required `Uint8Array` fields.
 *
 * This fires if the builder goes back to taking the parts a transaction is
 * made from (a type URL, message bytes, a signer address), or if the signed
 * encodings become an optional alternative to such parts — either of which
 * reopens a path where the transaction is re-derived instead of copied, and
 * stops matching its preimage as soon as the signer binds a field the
 * re-derivation does not set. The expected shape is written out rather than
 * taken from `SignDocResult`, so a field turning optional there cannot loosen
 * the pin along with it. A failure is a `tsc --noEmit` error.
 *
 * Its limits: a type cannot see whether the body and auth info are actually
 * decoded from those encodings — a builder that accepted them and ignored them
 * would pass; the round-trip tests in `test/tx-signed.test.ts` catch that.
 * And `Parameters<T>` reads only the **last** overload, so a parts-based
 * overload declared above the SignDoc one would pass unseen.
 *
 * Type-level for the same reason as the nonce pin in `sign-doc.ts`: this
 * package publishes its TypeScript sources, and a type alias emits nothing.
 */
type _SentTxIsTheSignedBytes = Assert<
  Parameters<typeof buildSignedTx>[0] extends {
    bodyBytes: Uint8Array;
    authInfoBytes: Uint8Array;
    nonce: Uint8Array;
  }
    ? true
    : false
>;
