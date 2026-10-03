/**
 * Runtime pins for the `gasLimit` option: every SignDoc builder passes a
 * declared gas limit into the signed `AuthInfo`, an omitted one declares the
 * signing package's default, and an invalid one is refused by the signing
 * package rather than replaced.
 *
 * The `_GasLimitReachesTheBinding` type pin in `src/sign-doc.ts` keeps the
 * option a field the binding declares, but a type cannot see whether a builder
 * forwards it. These tests read the gas limit back out of the signed preimage.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { fromBinary } from "@bufbuild/protobuf";
import { AuthInfoSchema, SignDocSchema } from "@morpheum/proto/tx/v1/tx_pb";
import * as sdk from "../src/index";
import {
  CLOB_ORDERBOOK,
  ChainType,
  DEFAULT_CHAIN_ID,
  MarketType,
  SignMode,
  buildBucketCreateSignDoc,
  buildBucketSetLeverageSignDoc,
  buildBucketTransferSignDoc,
  buildBucketTransferToBankSignDoc,
  buildClobCancelMarketMakerQuoteSignDoc,
  buildClobCancelOrderSignDoc,
  buildClobModifyOrderSignDoc,
  buildClobPlaceBatchOrdersSignDoc,
  buildClobPlaceOrderSignDoc,
  buildClobProvideMarketMakerQuoteSignDoc,
  buildMarketActivateSignDoc,
  buildMarketCreateSignDoc,
  buildMarketSuspendSignDoc,
  buildPositionCloseSignDoc,
  buildPositionUpdateLeverageSignDoc,
  buildRiskTriggerLiquidationSignDoc,
  buildSignDoc,
  encodeMsgCreateBucket,
  type SignDocOptions,
  type SignDocResult,
} from "../src/index";

const SIGNER = `0x${"11".repeat(20)}`;
/** Everything a builder takes between its message params and `options`. */
const ARGS = [
  SIGNER,
  ChainType.ETHEREUM,
  SignMode.EIP191_PERSONAL,
  { chainId: DEFAULT_CHAIN_ID, genesisHash: new Uint8Array(32).fill(7) },
  "",
] as const;
const CREATE_BUCKET = {
  fromAddress: SIGNER,
  bucketId: "bucket-1",
  bucketType: 1,
  collateralAssetIndex: 0,
  initialMargin: "100",
};
const ORDER = {
  marketIndex: 1,
  price: "100",
  quantity: "1",
  side: 1,
  orderType: 1,
};

/** A declaration distinct from the default, so forwarding is observable. */
const DECLARED = 750_000n;

/**
 * The signing package's `DEFAULT_GAS_LIMIT`. Its wasm binding does not export
 * it, so it is mirrored here: changing it changes what every transaction built
 * without a declaration reserves, and this is where this SDK notices.
 */
const SIGNING_DEFAULT_GAS_LIMIT = 25_000n;

/**
 * Every SignDoc builder this SDK exports, by its export name, called with
 * `options` as given.
 */
const BUILDERS: Record<string, (options: SignDocOptions) => SignDocResult> = {
  buildSignDoc: (o) =>
    buildSignDoc(
      "/bucket.v1.MsgCreateBucketRequest",
      encodeMsgCreateBucket(CREATE_BUCKET),
      ...ARGS,
      o,
    ),
  buildBucketCreateSignDoc: (o) =>
    buildBucketCreateSignDoc(CREATE_BUCKET, ...ARGS, o),
  buildBucketTransferSignDoc: (o) =>
    buildBucketTransferSignDoc(
      {
        fromAddress: SIGNER,
        sourceBucketId: "bucket-1",
        targetBucketId: "bucket-2",
        amount: "1",
      },
      ...ARGS,
      o,
    ),
  buildBucketTransferToBankSignDoc: (o) =>
    buildBucketTransferToBankSignDoc(
      { fromAddress: SIGNER, bucketId: "bucket-1", assetIndex: 0, amount: "1" },
      ...ARGS,
      o,
    ),
  buildBucketSetLeverageSignDoc: (o) =>
    buildBucketSetLeverageSignDoc(
      { fromAddress: SIGNER, bucketId: "bucket-1", marketIndex: 1, leverage: 2 },
      ...ARGS,
      o,
    ),
  buildClobPlaceOrderSignDoc: (o) =>
    buildClobPlaceOrderSignDoc({ fromAddress: SIGNER, ...ORDER }, ...ARGS, o),
  buildClobPlaceBatchOrdersSignDoc: (o) =>
    buildClobPlaceBatchOrdersSignDoc(
      { fromAddress: SIGNER, orders: [ORDER, ORDER] },
      ...ARGS,
      o,
    ),
  buildClobModifyOrderSignDoc: (o) =>
    buildClobModifyOrderSignDoc(
      { fromAddress: SIGNER, orderId: "order-1", newPrice: "101" },
      ...ARGS,
      o,
    ),
  buildClobCancelOrderSignDoc: (o) =>
    buildClobCancelOrderSignDoc(
      { fromAddress: SIGNER, orderId: "order-1" },
      ...ARGS,
      o,
    ),
  buildClobProvideMarketMakerQuoteSignDoc: (o) =>
    buildClobProvideMarketMakerQuoteSignDoc(
      {
        provider: SIGNER,
        poolId: "pool-1",
        marketIndex: 1,
        side: 1,
        price: "100",
        amount: "1",
      },
      ...ARGS,
      o,
    ),
  buildClobCancelMarketMakerQuoteSignDoc: (o) =>
    buildClobCancelMarketMakerQuoteSignDoc(
      { quoteId: "quote-1", provider: SIGNER },
      ...ARGS,
      o,
    ),
  buildMarketCreateSignDoc: (o) =>
    buildMarketCreateSignDoc(
      {
        fromAddress: SIGNER,
        baseAssetIndex: 1,
        quoteAssetIndex: 0,
        marketType: MarketType.SPOT,
        orderbookType: CLOB_ORDERBOOK,
        params: { minOrderSize: "1", tickSize: "1", lotSize: "1" },
      },
      ...ARGS,
      o,
    ),
  buildMarketActivateSignDoc: (o) =>
    buildMarketActivateSignDoc(
      { activator: SIGNER, marketIndex: 1 },
      ...ARGS,
      o,
    ),
  buildMarketSuspendSignDoc: (o) =>
    buildMarketSuspendSignDoc(
      { suspender: SIGNER, marketIndex: 1, reason: "halt" },
      ...ARGS,
      o,
    ),
  buildPositionCloseSignDoc: (o) =>
    buildPositionCloseSignDoc(
      { fromAddress: SIGNER, marketIndex: 1, exitPrice: "100" },
      ...ARGS,
      o,
    ),
  buildPositionUpdateLeverageSignDoc: (o) =>
    buildPositionUpdateLeverageSignDoc(
      { fromAddress: SIGNER, marketIndex: 1, newLeverage: "2" },
      ...ARGS,
      o,
    ),
  buildRiskTriggerLiquidationSignDoc: (o) =>
    buildRiskTriggerLiquidationSignDoc({ marketIndex: 1 }, ...ARGS, o),
};

/**
 * The gas limit in the `AuthInfo` the signature covers — decoded from the
 * SignDoc preimage, not from the separately returned `authInfoBytes` — and
 * whether those returned bytes, the ones `buildSignedTx` ships, are the signed
 * ones.
 */
function signedGas(signDoc: SignDocResult): {
  gasLimit: bigint;
  shipsTheSignedAuthInfo: boolean;
} {
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  return {
    gasLimit: fromBinary(AuthInfoSchema, preimage.authInfoBytes).gasLimit,
    shipsTheSignedAuthInfo:
      Buffer.compare(preimage.authInfoBytes, signDoc.authInfoBytes) === 0,
  };
}

describe("gasLimit", () => {
  it("covers every SignDoc builder this SDK exports", () => {
    const exported = Object.keys(sdk)
      .filter((name) => /^build\w*SignDoc$/.test(name))
      .sort();
    assert.deepEqual(Object.keys(BUILDERS).sort(), exported);
  });

  it("is signed as declared, or as the signing default when omitted, by every builder", () => {
    const expected = {
      declared: { gasLimit: DECLARED, shipsTheSignedAuthInfo: true },
      omitted: {
        gasLimit: SIGNING_DEFAULT_GAS_LIMIT,
        shipsTheSignedAuthInfo: true,
      },
    };
    // Only the builders that deviate, keyed by name, so a failure's diff
    // names each one and what it signed rather than eliding it in a table.
    const deviating = Object.fromEntries(
      Object.entries(BUILDERS).flatMap(([name, build]) => {
        const signed = {
          declared: signedGas(build({ gasLimit: DECLARED })),
          omitted: signedGas(build({})),
        };
        return isDeepStrictEqual(signed, expected) ? [] : [[name, signed]];
      }),
    );
    assert.deepEqual(deviating, {});
  });

  it("is refused by the signing package when invalid, never replaced by the default", () => {
    assert.throws(
      () => BUILDERS.buildClobPlaceOrderSignDoc({ gasLimit: 0n }),
      /invalid gasLimit/,
    );
  });
});
