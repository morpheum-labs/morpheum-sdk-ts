/**
 * Canonical SignDoc construction — the single place this SDK decides what a
 * transaction's signature covers.
 *
 * Every module builder routes through {@link buildSignDoc}. It used to be a
 * `wasmSignDoc` helper copy-pasted into each module, and all five copies made
 * the same mistake: they called the ten-parameter `buildSignDocBytes` with
 * eight arguments, so `genesisHash` and `nonce` arrived `undefined`. The
 * signature covered a **nonce-less** preimage, and a fresh nonce was then
 * fabricated at assembly time — shipping a replay-protection field that no
 * signature covered. An observer could rewrite it and resubmit: the signature
 * still verified (the nonce was outside the preimage), the deduplication hash
 * changed, and the chain admitted it as a new transaction.
 *
 * One helper, one call site, and a nonce that travels with the preimage it was
 * bound into is what makes that divergence unrepresentable rather than merely
 * discouraged.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import { NonceSchema, type Nonce } from "@morpheum/proto/tx/v1/tx_pb";
import { buildSignDocBytes } from "@morpheum/signing-node";

/**
 * A canonical SignDoc together with everything needed to assemble the matching
 * transaction.
 *
 * `nonce` is the encoded {@link Nonce} the preimage actually bound. Pass it
 * straight to the signed-transaction builders: it is the only nonce that will
 * verify, because it is the one the signature covers.
 */
export interface SignDocResult {
  signDocHash: string;
  signDocBytes: Uint8Array;
  bodyBytes: Uint8Array;
  authInfoBytes: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Mints the nonce a transaction will bind.
 *
 * Chain-side admission (`check_nonce_admission`) accepts any monotonically
 * ahead, in-window nonce, and the timestamp component is what separates
 * successive transactions from one signer. This reproduces the value the SDK
 * has always put on the wire — the change here is that it is now *signed*.
 *
 * Callers that track their own account nonce should pass an explicit value to
 * {@link buildSignDoc} instead of relying on this.
 */
export function newNonce(): Nonce {
  return create(NonceSchema, {
    monotonic: 0n,
    tsMs: Date.now() % 0x100000000,
    sub: 0,
  });
}

/**
 * The chain a transaction is being signed for.
 *
 * `chainId` and `genesisHash` travel together because the verifier selects
 * acceptable signing preimages from both at once — they are one fact about one
 * chain, not two independent settings, and separating them is how they drift.
 *
 * Deliberately a single object rather than two positional parameters. This
 * SDK's original defect was a ten-parameter call made with eight arguments:
 * the trailing bindings silently defaulted, and every transaction shipped a
 * nonce no signature covered. Adding another optional trailing parameter would
 * reproduce that failure mode exactly. A missing field on a named object is a
 * type error; a missing trailing argument is a security downgrade.
 *
 * # Trust
 *
 * Both values are chain identity and belong to the same trust root: operator
 * configuration. Neither should be fetched from the node being submitted to. A
 * client that asked its RPC endpoint for the genesis hash and signed against
 * the answer would let whoever controls that endpoint choose which chain the
 * signature authorises — the cross-chain replay the binding exists to prevent.
 */
export interface ChainIdentity {
  chainId: string;
  /**
   * The target chain's genesis hash (Phase M3), which stops a signature valid
   * on one chain being replayed onto another that shares its `chainId`.
   *
   * Optional while the strict genesis fork is advisory: verifiers still accept
   * unbound signatures, placing them on the `GenesisUnbound` preimage rung.
   * Supply it wherever it is configured — that is what moves adoption toward
   * the point where the fork can safely activate.
   */
  genesisHash?: Uint8Array;
}

/** Optional bindings a caller can add to the signing preimage. */
export interface SignDocOptions {
  /**
   * The nonce to bind. Defaults to {@link newNonce}. Whatever is bound here is
   * returned in {@link SignDocResult.nonce} and must be the value sent.
   */
  nonce?: Nonce;
}

/**
 * Builds the canonical SignDoc bytes for a single-message transaction.
 *
 * The returned `nonce` is bound into the preimage, so the caller must stamp
 * exactly that value onto `Tx.nonce`.
 */
export function buildSignDoc(
  typeUrl: string,
  msgBytes: Uint8Array,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string,
  options: SignDocOptions = {},
): SignDocResult {
  const nonce = options.nonce ?? newNonce();
  const result = buildSignDocBytes(
    typeUrl,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chain.chainId,
    memo || undefined,
    undefined,
    chain.genesisHash,
    toBinary(NonceSchema, nonce),
  );
  return {
    signDocHash: result.signDocHash,
    signDocBytes: new Uint8Array(result.signDocBytes),
    bodyBytes: new Uint8Array(result.bodyBytes),
    authInfoBytes: new Uint8Array(result.authInfoBytes),
    // Taken from the binding's own re-encoding of what it bound, not from the
    // `nonce` above, so the wire value is derived from the signed one rather
    // than merely intended to match it.
    nonce: new Uint8Array(result.nonce),
  };
}
