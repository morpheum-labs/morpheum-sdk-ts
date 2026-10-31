#!/usr/bin/env npx tsx
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

type Barrel = typeof import("../../../../src/index.ts");

const FEATURE_IDS = [
  "build-signed-tx",
  "sign-doc-gas-limit",
  "create-market-terms",
  "clob-place-order",
  "clob-cancel-order",
  "clob-modify-order",
  "clob-place-batch-orders",
  "clob-provide-mm-quote",
  "clob-cancel-mm-quote",
  "bucket-create",
  "position-close",
  "risk-trigger-liquidation",
  "position-update-leverage",
  "bucket-transfer-between-buckets",
  "bucket-transfer-to-bank",
  "bucket-set-leverage",
  "grpc-query-client",
  "ws-stream",
] as const;

type FeatureId = (typeof FEATURE_IDS)[number];

const SIGNER = `0x${"11".repeat(20)}`;
const SIGNATURE = new Uint8Array(65).fill(0xab);
const DECLARED_GAS = 750_000n;
const SIGNING_DEFAULT_GAS = 25_000n;

class UnmetPrecondition extends Error {
  readonly exitCode = 2;
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function requireArg(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

let barrelPromise: Promise<Barrel> | undefined;

function loadBarrel(repo: string): Promise<Barrel> {
  if (!barrelPromise) {
    const entry = path.join(repo, "src", "index.ts");
    barrelPromise = import(pathToFileURL(entry).href) as Promise<Barrel>;
  }
  return barrelPromise;
}

function chainFor(sdk: Barrel) {
  return {
    chainId: sdk.DEFAULT_CHAIN_ID,
    genesisHash: new Uint8Array(32).fill(7),
  };
}

function signArgs(sdk: Barrel) {
  return [
    SIGNER,
    sdk.ChainType.ETHEREUM,
    sdk.SignMode.EIP191_PERSONAL,
    chainFor(sdk),
    "",
  ] as const;
}

const CREATE_BUCKET = {
  fromAddress: SIGNER,
  bucketId: "bucket-1",
  bucketType: 1,
  collateralAssetIndex: 0,
  initialMargin: "100",
};

const CLOSE_POSITION = {
  fromAddress: SIGNER,
  marketIndex: 0,
  exitPrice: "100",
};

const TRIGGER_LIQUIDATION = {
  marketIndex: 1,
  bucketId: "7",
};

const UPDATE_POSITION_LEVERAGE = {
  fromAddress: SIGNER,
  marketIndex: 1,
  newLeverage: "5",
  positionId: "3",
  bucketId: "7",
};

const TRANSFER_BETWEEN_BUCKETS = {
  fromAddress: SIGNER,
  sourceBucketId: "7",
  targetBucketId: "9",
  amount: "1000",
  reason: "rebalance",
};

const TRANSFER_TO_BANK = {
  fromAddress: SIGNER,
  bucketId: "7",
  assetIndex: 3,
  amount: "1000",
};

const SET_BUCKET_LEVERAGE = {
  fromAddress: SIGNER,
  bucketId: "7",
  marketIndex: 1,
  leverage: 5,
};

const LIMIT_BUY_TERMS = {
  fromAddress: SIGNER,
  marketIndex: 0,
  price: "100",
  quantity: "1",
};

function limitBuy(sdk: Barrel) {
  return {
    ...LIMIT_BUY_TERMS,
    side: sdk.Side.BUY,
    orderType: sdk.OrderType.LIMIT,
  };
}

const CANCEL_ORDER = {
  fromAddress: SIGNER,
  orderId: "order-1",
};

const MODIFY_ORDER = {
  fromAddress: SIGNER,
  orderId: "order-1",
  newPrice: "101",
  newQuantity: "2",
};

function provideMmQuote(sdk: Barrel) {
  return {
    provider: SIGNER,
    poolId: "pool-1",
    marketIndex: 0,
    side: sdk.Side.BUY,
    price: "100",
    amount: "1",
    durationSeconds: 60,
  };
}

const CANCEL_MM_QUOTE = {
  quoteId: "quote-1",
  provider: SIGNER,
};

function placeBatch(sdk: Barrel) {
  return {
    fromAddress: SIGNER,
    orders: [
      {
        marketIndex: 0,
        price: "100",
        quantity: "1",
        side: sdk.Side.BUY,
        orderType: sdk.OrderType.LIMIT,
      },
      {
        marketIndex: 0,
        price: "101",
        quantity: "2",
        side: sdk.Side.SELL,
        orderType: sdk.OrderType.LIMIT,
      },
    ],
  };
}

async function leaveRoomInThisSecond(marginMs: number): Promise<void> {
  const remain = 1000 - (Date.now() % 1000);
  if (remain < marginMs) {
    await new Promise((resolve) => setTimeout(resolve, remain + 5));
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.compare(left, right) === 0;
}

async function driveBuildSignedTx(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const {
    AuthInfoSchema,
    NonceSchema,
    TxBodySchema,
  } = await import("@morpheum/proto/tx/v1/tx_pb");
  const { create, toBinary } = await import("@bufbuild/protobuf");
  const { BinaryWriter, WireType } = await import("@bufbuild/protobuf/wire");

  const signDoc = sdk.buildBucketCreateSignDoc(
    CREATE_BUCKET,
    ...signArgs(sdk),
  );
  const tx = sdk.buildSignedTx(signDoc, SIGNATURE);
  assert.ok(tx.body && tx.authInfo && tx.nonce);
  const moduleRoundTrip =
    bytesEqual(toBinary(TxBodySchema, tx.body), signDoc.bodyBytes) &&
    bytesEqual(toBinary(AuthInfoSchema, tx.authInfo), signDoc.authInfoBytes) &&
    bytesEqual(toBinary(NonceSchema, tx.nonce), signDoc.nonce) &&
    tx.signatures.length === 1 &&
    bytesEqual(tx.signatures[0], SIGNATURE) &&
    tx.body.messages.length === 1 &&
    tx.body.messages[0].typeUrl === "/bucket.v1.MsgCreateBucketRequest" &&
    bytesEqual(tx.body.messages[0].value, sdk.encodeMsgCreateBucket(CREATE_BUCKET));
  assert.equal(moduleRoundTrip, true);

  // One past the highest field this package's TxBody schema declares, so the
  // extra byte stays unknown to the decoder and must still round-trip.
  const unknownFieldNo =
    Math.max(...TxBodySchema.fields.map((field) => field.number)) + 1;
  const body = create(TxBodySchema, {
    messages: [
      {
        typeUrl: "/bucket.v1.MsgCreateBucketRequest",
        value: sdk.encodeMsgCreateBucket(CREATE_BUCKET),
      },
    ],
    memo: "memo",
    txClass: 2,
    urgent: true,
  });
  const authInfo = create(AuthInfoSchema, {
    signerInfos: [
      {
        publicKey: {
          typeUrl: "/cosmos.crypto.secp256k1.PubKey",
          value: new Uint8Array(20).fill(0x11),
        },
        modeInfo: {
          sum: { case: "single", value: { mode: sdk.SignMode.EIP191_PERSONAL } },
        },
        chainType: sdk.ChainType.ETHEREUM,
      },
    ],
    gasLimit: SIGNING_DEFAULT_GAS,
  });
  const signed = {
    bodyBytes: new BinaryWriter()
      .raw(toBinary(TxBodySchema, body))
      .tag(unknownFieldNo, WireType.Varint)
      .uint32(1)
      .finish(),
    authInfoBytes: toBinary(AuthInfoSchema, authInfo),
    nonce: toBinary(
      NonceSchema,
      create(NonceSchema, { monotonic: 7n, tsMs: 1_234_567, sub: 3 }),
    ),
  };
  const unknownTx = sdk.buildSignedTx(signed, SIGNATURE);
  assert.equal(unknownTx.authInfo?.gasLimit, SIGNING_DEFAULT_GAS);
  assert.equal(unknownTx.body?.txClass, 2);
  assert.equal(unknownTx.body?.urgent, true);
  assert.ok(unknownTx.body && unknownTx.authInfo && unknownTx.nonce);
  const unknownFieldRoundTrip =
    bytesEqual(toBinary(TxBodySchema, unknownTx.body), signed.bodyBytes) &&
    bytesEqual(toBinary(AuthInfoSchema, unknownTx.authInfo), signed.authInfoBytes) &&
    bytesEqual(toBinary(NonceSchema, unknownTx.nonce), signed.nonce);
  assert.equal(unknownFieldRoundTrip, true);

  return {
    moduleRoundTrip,
    unknownFieldRoundTrip,
    unknownFieldNo,
    messageTypeUrl: tx.body.messages[0].typeUrl,
    bodyByteLength: signDoc.bodyBytes.byteLength,
    authInfoByteLength: signDoc.authInfoBytes.byteLength,
    nonceByteLength: signDoc.nonce.byteLength,
  };
}

async function signedGas(
  signDoc: { signDocBytes: Uint8Array; authInfoBytes: Uint8Array },
): Promise<{ gasLimit: string; shipsTheSignedAuthInfo: boolean }> {
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { AuthInfoSchema, SignDocSchema } = await import("@morpheum/proto/tx/v1/tx_pb");
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  return {
    gasLimit: fromBinary(AuthInfoSchema, preimage.authInfoBytes).gasLimit.toString(),
    shipsTheSignedAuthInfo: bytesEqual(preimage.authInfoBytes, signDoc.authInfoBytes),
  };
}

async function driveGasLimit(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const declared = await signedGas(
    sdk.buildSignDoc(
      "/bucket.v1.MsgCreateBucketRequest",
      sdk.encodeMsgCreateBucket(CREATE_BUCKET),
      ...signArgs(sdk),
      { gasLimit: DECLARED_GAS },
    ),
  );
  const omitted = await signedGas(
    sdk.buildSignDoc(
      "/bucket.v1.MsgCreateBucketRequest",
      sdk.encodeMsgCreateBucket(CREATE_BUCKET),
      ...signArgs(sdk),
      {},
    ),
  );
  assert.deepEqual(declared, {
    gasLimit: DECLARED_GAS.toString(),
    shipsTheSignedAuthInfo: true,
  });
  assert.deepEqual(omitted, {
    gasLimit: SIGNING_DEFAULT_GAS.toString(),
    shipsTheSignedAuthInfo: true,
  });
  assert.throws(
    () =>
      sdk.buildSignDoc(
        "/bucket.v1.MsgCreateBucketRequest",
        sdk.encodeMsgCreateBucket(CREATE_BUCKET),
        ...signArgs(sdk),
        { gasLimit: 0n },
      ),
    /invalid gasLimit/,
  );

  const tsx = path.join(repo, "node_modules", ".bin", "tsx");
  const test = spawnSync(tsx, ["--test", "test/gas-limit.test.ts"], {
    cwd: repo,
    encoding: "utf8",
  });
  const testOutput = `${test.stdout ?? ""}${test.stderr ?? ""}`;
  process.stdout.write(testOutput);
  assert.equal(test.status, 0, "test/gas-limit.test.ts failed");

  return {
    declared,
    omitted,
    invalidRejected: true,
    gasLimitTestExit: test.status,
  };
}

function spotMarket(sdk: Barrel, params: Barrel["MarketParamsInput"] & { orderbookType?: string; marketType?: number } = { minOrderSize: "1" }) {
  return {
    fromAddress: SIGNER,
    baseAssetIndex: 1,
    quoteAssetIndex: 0,
    marketType: params.marketType ?? sdk.MarketType.SPOT,
    orderbookType: params.orderbookType ?? sdk.CLOB_ORDERBOOK,
    params: {
      minOrderSize: params.minOrderSize,
      tickSize: params.tickSize,
      lotSize: params.lotSize,
      maxLeverage: params.maxLeverage,
    },
  };
}

async function driveCreateMarket(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  assert.equal(typeof sdk.MarketType.PREDICTION, "number");
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgCreateMarketRequestSchema } = await import(
    "@morpheum/proto/market/v1/tx_pb"
  );

  const clob = spotMarket(sdk, { minOrderSize: "1", tickSize: "1", lotSize: "1" });
  const clobMsg = fromBinary(
    MsgCreateMarketRequestSchema,
    sdk.encodeMsgCreateMarket(clob),
  );
  assert.equal(clobMsg.params?.tickSize, "1");
  assert.equal(clobMsg.params?.lotSize, "1");
  assert.equal(clobMsg.params?.maxLeverage, "");
  const signDoc = sdk.buildMarketCreateSignDoc(clob, ...signArgs(sdk));
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  assert.ok(signDoc.bodyBytes.byteLength > 0);

  assert.throws(
    () =>
      sdk.encodeMsgCreateMarket(
        spotMarket(sdk, { minOrderSize: "1", tickSize: "0.01", lotSize: "1" }),
      ),
    /tickSize/,
  );
  assert.throws(
    () =>
      sdk.buildMarketCreateSignDoc(
        spotMarket(sdk, { minOrderSize: "1", tickSize: "0.01", lotSize: "1" }),
        ...signArgs(sdk),
      ),
    /tickSize/,
  );
  assert.throws(
    () => sdk.encodeMsgCreateMarket(spotMarket(sdk, { minOrderSize: "" })),
    /minOrderSize is required/,
  );
  assert.throws(
    () =>
      sdk.encodeMsgCreateMarket(
        spotMarket(sdk, {
          minOrderSize: "1",
          tickSize: "1",
          lotSize: "1",
          orderbookType: "amm",
        }),
      ),
    /orderbookType/,
  );

  const offClob = spotMarket(sdk, {
    minOrderSize: "1",
    marketType: sdk.MarketType.PREDICTION,
    orderbookType: "amm",
  });
  const offMsg = fromBinary(
    MsgCreateMarketRequestSchema,
    sdk.encodeMsgCreateMarket(offClob),
  );
  assert.equal(offMsg.params?.tickSize, "");
  assert.equal(offMsg.params?.lotSize, "");
  assert.equal(offMsg.params?.maxLeverage, "");
  assert.throws(
    () =>
      sdk.encodeMsgCreateMarket(
        spotMarket(sdk, {
          minOrderSize: "1",
          tickSize: "1",
          lotSize: "1",
          marketType: sdk.MarketType.PREDICTION,
          orderbookType: "amm",
        }),
      ),
    /does not trade on the CLOB/,
  );

  return {
    clobTickSize: clobMsg.params?.tickSize,
    clobLotSize: clobMsg.params?.lotSize,
    clobMaxLeverage: clobMsg.params?.maxLeverage,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    offClobTickSize: offMsg.params?.tickSize,
    decimalTickRejected: true,
    signDocRefusedDecimalTick: true,
    offClobTermsRejected: true,
  };
}

async function driveClobPlaceOrder(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const order = limitBuy(sdk);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgPlaceOrderRequestSchema } = await import("@morpheum/proto/clob/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgPlaceOrder(order);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgPlaceOrderRequestSchema, encoded);
  assert.equal(msg.price, order.price);
  assert.equal(msg.quantity, order.quantity);
  assert.equal(msg.side, sdk.Side.BUY);
  assert.equal(msg.orderType, sdk.OrderType.LIMIT);
  assert.equal(msg.marketIndex, BigInt(order.marketIndex));

  const signDoc = sdk.buildClobPlaceOrderSignDoc(order, ...signArgs(sdk));
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const placed = body.messages[0];
  assert.ok(placed);
  assert.equal(placed.typeUrl, "/clob.v1.MsgPlaceOrderRequest");
  const bodyMatchesEncoded = bytesEqual(placed.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    price: msg.price,
    quantity: msg.quantity,
    side: msg.side,
    orderType: msg.orderType,
    marketIndex: msg.marketIndex.toString(),
    typeUrl: placed.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function driveClobCancelOrder(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgCancelOrderRequestSchema } = await import("@morpheum/proto/clob/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgCancelOrder(CANCEL_ORDER);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgCancelOrderRequestSchema, encoded);
  assert.equal(msg.orderId, CANCEL_ORDER.orderId);
  assert.equal(msg.address, CANCEL_ORDER.fromAddress);
  assert.equal(msg.symbol, "");

  const signDoc = sdk.buildClobCancelOrderSignDoc(CANCEL_ORDER, ...signArgs(sdk));
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const cancelled = body.messages[0];
  assert.ok(cancelled);
  assert.equal(cancelled.typeUrl, "/clob.v1.MsgCancelOrderRequest");
  const bodyMatchesEncoded = bytesEqual(cancelled.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    orderId: msg.orderId,
    address: msg.address,
    symbol: msg.symbol,
    typeUrl: cancelled.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function driveClobModifyOrder(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgModifyOrderRequestSchema } = await import("@morpheum/proto/clob/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgModifyOrder(MODIFY_ORDER);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgModifyOrderRequestSchema, encoded);
  assert.equal(msg.orderId, MODIFY_ORDER.orderId);
  assert.equal(msg.address, MODIFY_ORDER.fromAddress);
  assert.equal(msg.symbol, "");
  assert.equal(msg.newPrice, MODIFY_ORDER.newPrice);
  assert.equal(msg.newQuantity, MODIFY_ORDER.newQuantity);

  const signDoc = sdk.buildClobModifyOrderSignDoc(MODIFY_ORDER, ...signArgs(sdk));
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const modified = body.messages[0];
  assert.ok(modified);
  assert.equal(modified.typeUrl, "/clob.v1.MsgModifyOrderRequest");
  const bodyMatchesEncoded = bytesEqual(modified.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    orderId: msg.orderId,
    address: msg.address,
    symbol: msg.symbol,
    newPrice: msg.newPrice,
    newQuantity: msg.newQuantity,
    typeUrl: modified.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function driveClobPlaceBatchOrders(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const batch = placeBatch(sdk);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgPlaceBatchOrdersRequestSchema } = await import("@morpheum/proto/clob/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  // encode and SignDoc each read Date.now(). Stay clear of the second
  // boundary so those two calls can share one timestamp. The clock stays real.
  await leaveRoomInThisSecond(200);
  const encoded = sdk.encodeMsgPlaceBatchOrders(batch);
  const signDoc = sdk.buildClobPlaceBatchOrdersSignDoc(batch, ...signArgs(sdk));
  assert.ok(encoded.byteLength > 0);
  assert.ok(signDoc.signDocBytes.byteLength > 0);

  const msg = fromBinary(MsgPlaceBatchOrdersRequestSchema, encoded);
  assert.equal(msg.fromAddress, batch.fromAddress);
  assert.equal(msg.orders.length, batch.orders.length);
  assert.ok(msg.ordersHash.length > 0);
  const ordersHashNonEmpty = msg.ordersHash.length > 0;
  for (let i = 0; i < batch.orders.length; i++) {
    const expected = batch.orders[i];
    const order = msg.orders[i];
    assert.ok(expected && order);
    assert.equal(order.address, batch.fromAddress);
    assert.equal(order.marketIndex, BigInt(expected.marketIndex));
    assert.equal(order.price, expected.price);
    assert.equal(order.quantity, expected.quantity);
    assert.equal(order.side, expected.side);
    assert.equal(order.orderType, expected.orderType);
    assert.ok(order.timestamp);
    assert.ok(order.timestamp.seconds > 0n);
    assert.equal(order.timestamp.nanos, 0);
  }
  const first = msg.orders[0];
  assert.ok(first?.timestamp);
  for (const order of msg.orders) {
    assert.equal(order.timestamp?.seconds, first.timestamp.seconds);
  }

  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const placed = body.messages[0];
  assert.ok(placed);
  assert.equal(placed.typeUrl, "/clob.v1.MsgPlaceBatchOrdersRequest");
  const bodyMatchesEncoded = bytesEqual(placed.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    orderCount: msg.orders.length,
    fromAddress: msg.fromAddress,
    prices: msg.orders.map((order) => order.price),
    quantities: msg.orders.map((order) => order.quantity),
    sides: msg.orders.map((order) => order.side),
    orderTypes: msg.orders.map((order) => order.orderType),
    firstPrice: first.price,
    firstQuantity: first.quantity,
    firstSide: first.side,
    firstOrderType: first.orderType,
    ordersHashNonEmpty,
    ordersHash: msg.ordersHash,
    timestampSeconds: first.timestamp.seconds.toString(),
    typeUrl: placed.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function driveClobProvideMmQuote(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const quote = provideMmQuote(sdk);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgProvideMarketMakerQuoteRequestSchema } = await import("@morpheum/proto/clob/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgProvideMarketMakerQuote(quote);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgProvideMarketMakerQuoteRequestSchema, encoded);
  assert.equal(msg.provider, quote.provider);
  assert.equal(msg.poolId, quote.poolId);
  assert.equal(msg.marketIndex, BigInt(quote.marketIndex));
  assert.equal(msg.side, sdk.Side.BUY);
  assert.equal(msg.price, quote.price);
  assert.equal(msg.amount, quote.amount);
  assert.ok(msg.duration);
  assert.equal(msg.duration.seconds, BigInt(quote.durationSeconds));
  assert.equal(msg.duration.nanos, 0);

  const signDoc = sdk.buildClobProvideMarketMakerQuoteSignDoc(quote, ...signArgs(sdk));
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const quoted = body.messages[0];
  assert.ok(quoted);
  assert.equal(quoted.typeUrl, "/clob.v1.MsgProvideMarketMakerQuoteRequest");
  const bodyMatchesEncoded = bytesEqual(quoted.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    provider: msg.provider,
    poolId: msg.poolId,
    marketIndex: msg.marketIndex.toString(),
    side: msg.side,
    price: msg.price,
    amount: msg.amount,
    durationSeconds: msg.duration.seconds.toString(),
    typeUrl: quoted.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function driveClobCancelMmQuote(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgCancelMarketMakerQuoteRequestSchema } = await import("@morpheum/proto/clob/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgCancelMarketMakerQuote(CANCEL_MM_QUOTE);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgCancelMarketMakerQuoteRequestSchema, encoded);
  assert.equal(msg.quoteId, CANCEL_MM_QUOTE.quoteId);
  assert.equal(msg.provider, CANCEL_MM_QUOTE.provider);

  const signDoc = sdk.buildClobCancelMarketMakerQuoteSignDoc(CANCEL_MM_QUOTE, ...signArgs(sdk));
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const cancelled = body.messages[0];
  assert.ok(cancelled);
  assert.equal(cancelled.typeUrl, "/clob.v1.MsgCancelMarketMakerQuoteRequest");
  const bodyMatchesEncoded = bytesEqual(cancelled.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    quoteId: msg.quoteId,
    provider: msg.provider,
    typeUrl: cancelled.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function driveBucketCreate(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgCreateBucketRequestSchema } = await import("@morpheum/proto/bucket/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgCreateBucket(CREATE_BUCKET);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgCreateBucketRequestSchema, encoded);
  assert.equal(msg.bucketId, CREATE_BUCKET.bucketId);
  assert.equal(msg.bucketType, CREATE_BUCKET.bucketType);
  assert.equal(msg.collateralAssetIndex, BigInt(CREATE_BUCKET.collateralAssetIndex));
  assert.equal(msg.initialMargin, CREATE_BUCKET.initialMargin);

  const signDoc = sdk.buildBucketCreateSignDoc(CREATE_BUCKET, ...signArgs(sdk));
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const created = body.messages[0];
  assert.ok(created);
  assert.equal(created.typeUrl, "/bucket.v1.MsgCreateBucketRequest");
  const bodyMatchesEncoded = bytesEqual(created.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    bucketId: msg.bucketId,
    bucketType: msg.bucketType,
    collateralAssetIndex: msg.collateralAssetIndex.toString(),
    initialMargin: msg.initialMargin,
    typeUrl: created.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function driveBucketTransferBetweenBuckets(
  repo: string,
): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgTransferBetweenBucketsRequestSchema } = await import(
    "@morpheum/proto/bucket/v1/tx_pb"
  );
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgTransferBetweenBuckets(TRANSFER_BETWEEN_BUCKETS);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgTransferBetweenBucketsRequestSchema, encoded);
  assert.equal(msg.sourceBucketId, TRANSFER_BETWEEN_BUCKETS.sourceBucketId);
  assert.equal(msg.targetBucketId, TRANSFER_BETWEEN_BUCKETS.targetBucketId);
  assert.equal(msg.amount, TRANSFER_BETWEEN_BUCKETS.amount);
  assert.equal(msg.reason, TRANSFER_BETWEEN_BUCKETS.reason);

  const signDoc = sdk.buildBucketTransferSignDoc(
    TRANSFER_BETWEEN_BUCKETS,
    ...signArgs(sdk),
  );
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const transferred = body.messages[0];
  assert.ok(transferred);
  assert.equal(transferred.typeUrl, "/bucket.v1.MsgTransferBetweenBucketsRequest");
  const bodyMatchesEncoded = bytesEqual(transferred.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    sourceBucketId: msg.sourceBucketId,
    targetBucketId: msg.targetBucketId,
    amount: msg.amount,
    reason: msg.reason,
    msgByteLength: encoded.byteLength,
    typeUrl: transferred.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function driveBucketTransferToBank(
  repo: string,
): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgTransferToBankRequestSchema } = await import(
    "@morpheum/proto/bucket/v1/tx_pb"
  );
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgTransferToBank(TRANSFER_TO_BANK);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgTransferToBankRequestSchema, encoded);
  assert.equal(msg.bucketId, TRANSFER_TO_BANK.bucketId);
  assert.equal(msg.assetIndex, BigInt(TRANSFER_TO_BANK.assetIndex));
  assert.equal(msg.amount, TRANSFER_TO_BANK.amount);

  const signDoc = sdk.buildBucketTransferToBankSignDoc(
    TRANSFER_TO_BANK,
    ...signArgs(sdk),
  );
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const withdrawn = body.messages[0];
  assert.ok(withdrawn);
  assert.equal(withdrawn.typeUrl, "/bucket.v1.MsgTransferToBankRequest");
  const bodyMatchesEncoded = bytesEqual(withdrawn.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    bucketId: msg.bucketId,
    assetIndex: msg.assetIndex.toString(),
    amount: msg.amount,
    msgByteLength: encoded.byteLength,
    typeUrl: withdrawn.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function driveBucketSetLeverage(
  repo: string,
): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgSetLeverageSchema } = await import("@morpheum/proto/bucket/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgSetLeverage(SET_BUCKET_LEVERAGE);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgSetLeverageSchema, encoded);
  assert.equal(msg.bucketId, SET_BUCKET_LEVERAGE.bucketId);
  assert.equal(msg.marketIndex, BigInt(SET_BUCKET_LEVERAGE.marketIndex));
  assert.equal(msg.leverage, SET_BUCKET_LEVERAGE.leverage);

  const signDoc = sdk.buildBucketSetLeverageSignDoc(
    SET_BUCKET_LEVERAGE,
    ...signArgs(sdk),
  );
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const levered = body.messages[0];
  assert.ok(levered);
  assert.equal(levered.typeUrl, "/bucket.v1.MsgSetLeverage");
  const bodyMatchesEncoded = bytesEqual(levered.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    bucketId: msg.bucketId,
    marketIndex: msg.marketIndex.toString(),
    leverage: msg.leverage,
    msgByteLength: encoded.byteLength,
    typeUrl: levered.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function drivePositionClose(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgClosePositionSchema } = await import("@morpheum/proto/position/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgClosePosition(CLOSE_POSITION);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgClosePositionSchema, encoded);
  assert.equal(msg.address, CLOSE_POSITION.fromAddress);
  assert.equal(msg.marketIndex, BigInt(CLOSE_POSITION.marketIndex));
  assert.equal(msg.exitPrice, BigInt(CLOSE_POSITION.exitPrice));
  assert.equal(msg.bucketId, 0n);

  const signDoc = sdk.buildPositionCloseSignDoc(CLOSE_POSITION, ...signArgs(sdk));
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const closed = body.messages[0];
  assert.ok(closed);
  assert.equal(closed.typeUrl, "/position.v1.Msg/ClosePosition");
  const bodyMatchesEncoded = bytesEqual(closed.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    address: msg.address,
    marketIndex: msg.marketIndex.toString(),
    exitPrice: msg.exitPrice.toString(),
    bucketId: msg.bucketId.toString(),
    typeUrl: closed.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function driveRiskTriggerLiquidation(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgTriggerLiquidationSchema } = await import("@morpheum/proto/risk/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgTriggerLiquidation(TRIGGER_LIQUIDATION);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgTriggerLiquidationSchema, encoded);
  assert.equal(msg.marketIndex, 1n);
  assert.equal(msg.bucketId, 7n);

  const signDoc = sdk.buildRiskTriggerLiquidationSignDoc(
    TRIGGER_LIQUIDATION,
    ...signArgs(sdk),
  );
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const triggered = body.messages[0];
  assert.ok(triggered);
  assert.equal(triggered.typeUrl, "/risk.v1.MsgTriggerLiquidation");
  const bodyMatchesEncoded = bytesEqual(triggered.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    marketIndex: msg.marketIndex.toString(),
    bucketId: msg.bucketId.toString(),
    msgByteLength: encoded.byteLength,
    typeUrl: triggered.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function drivePositionUpdateLeverage(repo: string): Promise<Record<string, unknown>> {
  const sdk = await loadBarrel(repo);
  const { fromBinary } = await import("@bufbuild/protobuf");
  const { MsgUpdatePositionLeverageSchema } = await import("@morpheum/proto/position/v1/tx_pb");
  const { SignDocSchema, TxBodySchema } = await import("@morpheum/proto/tx/v1/tx_pb");

  const encoded = sdk.encodeMsgUpdatePositionLeverage(UPDATE_POSITION_LEVERAGE);
  assert.ok(encoded.byteLength > 0);
  const msg = fromBinary(MsgUpdatePositionLeverageSchema, encoded);
  assert.equal(msg.address, UPDATE_POSITION_LEVERAGE.fromAddress);
  assert.equal(msg.positionId, "3");
  assert.equal(msg.bucketId, "7");
  assert.equal(msg.marketIndex, 1n);
  assert.equal(msg.newLeverage, "5");

  const signDoc = sdk.buildPositionUpdateLeverageSignDoc(
    UPDATE_POSITION_LEVERAGE,
    ...signArgs(sdk),
  );
  assert.ok(signDoc.signDocBytes.byteLength > 0);
  const preimage = fromBinary(SignDocSchema, signDoc.signDocBytes);
  assert.ok(bytesEqual(preimage.bodyBytes, signDoc.bodyBytes));
  const body = fromBinary(TxBodySchema, preimage.bodyBytes);
  assert.equal(body.messages.length, 1);
  const updated = body.messages[0];
  assert.ok(updated);
  assert.equal(updated.typeUrl, "/position.v1.Msg/UpdatePositionLeverage");
  const bodyMatchesEncoded = bytesEqual(updated.value, encoded);
  assert.equal(bodyMatchesEncoded, true);

  return {
    address: msg.address,
    positionId: msg.positionId,
    bucketId: msg.bucketId,
    marketIndex: msg.marketIndex.toString(),
    newLeverage: msg.newLeverage,
    msgByteLength: encoded.byteLength,
    typeUrl: updated.typeUrl,
    signDocByteLength: signDoc.signDocBytes.byteLength,
    bodyMatchesEncoded,
  };
}

async function withTimeout<T>(ms: number, work: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function driveGrpc(repo: string): Promise<Record<string, unknown>> {
  const baseUrl = process.env.MORPHEUM_GRPC_URL;
  if (!baseUrl) {
    throw new UnmetPrecondition(
      "MORPHEUM_GRPC_URL is unset. grpc-query-client needs a Mormcore gRPC base URL.",
    );
  }
  const sdk = await loadBarrel(repo);
  const client = new sdk.MormcoreGrpcClient({ baseUrl });
  try {
    const tips = await withTimeout(20_000, client.queryLatestTips(), "queryLatestTips");
    assert.equal(typeof tips, "object");
    assert.ok(tips);
    client.close();
    return {
      method: "queryLatestTips",
      responseKeys: Object.keys(tips),
    };
  } finally {
    client.close();
  }
}

async function driveWs(repo: string): Promise<Record<string, unknown>> {
  const url = process.env.MORPHEUM_WS_URL;
  if (!url) {
    throw new UnmetPrecondition(
      "MORPHEUM_WS_URL is unset. ws-stream needs a Morpheum multiplex WebSocket URL.",
    );
  }
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error(
      "global WebSocket is missing. Node 22 provides it. This drive does not inject a socket constructor.",
    );
  }
  const sdk = await loadBarrel(repo);
  const client = await withTimeout(
    15_000,
    sdk.MorpheumWsClient.connect({
      url,
      autoAuth: sdk.AuthCredentials.free(),
    }),
    "MorpheumWsClient.connect",
  );
  try {
    assert.equal(client.connected, true);
    const spec = sdk.ChannelSpec.allMids();
    const subscription = await withTimeout(
      15_000,
      client.subscribe(spec),
      "subscribe allMids",
    );
    assert.equal(subscription.channelSpec.routingKey, "allMids");
    assert.equal(subscription.closed, false);
    client.close();
    assert.equal(client.connected, false);
    assert.equal(subscription.closed, true);
    return {
      connected: true,
      routingKey: subscription.channelSpec.routingKey,
      closedAfterClose: subscription.closed,
    };
  } finally {
    client.close();
  }
}

const DRIVES: Record<FeatureId, (repo: string) => Promise<Record<string, unknown>>> = {
  "build-signed-tx": driveBuildSignedTx,
  "sign-doc-gas-limit": driveGasLimit,
  "create-market-terms": driveCreateMarket,
  "clob-place-order": driveClobPlaceOrder,
  "clob-cancel-order": driveClobCancelOrder,
  "clob-modify-order": driveClobModifyOrder,
  "clob-place-batch-orders": driveClobPlaceBatchOrders,
  "clob-provide-mm-quote": driveClobProvideMmQuote,
  "clob-cancel-mm-quote": driveClobCancelMmQuote,
  "bucket-create": driveBucketCreate,
  "position-close": drivePositionClose,
  "risk-trigger-liquidation": driveRiskTriggerLiquidation,
  "position-update-leverage": drivePositionUpdateLeverage,
  "bucket-transfer-between-buckets": driveBucketTransferBetweenBuckets,
  "bucket-transfer-to-bank": driveBucketTransferToBank,
  "bucket-set-leverage": driveBucketSetLeverage,
  "grpc-query-client": driveGrpc,
  "ws-stream": driveWs,
};

function writeProof(file: string, proof: unknown): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${path.basename(file)}.${process.pid}.tmp`,
  );
  fs.writeFileSync(tmp, `${JSON.stringify(proof, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

async function main(): Promise<number> {
  if (process.argv.includes("--list")) {
    for (const id of FEATURE_IDS) console.log(id);
    return 0;
  }

  const feature = requireArg("--feature");
  if (!FEATURE_IDS.includes(feature as FeatureId)) {
    throw new Error(
      `unknown feature ${feature}. Known features: ${FEATURE_IDS.join(", ")}`,
    );
  }
  const repo = path.resolve(requireArg("--repo"));
  const evidence = path.resolve(requireArg("--evidence"));
  const scratch = path.resolve(requireArg("--scratch"));
  const command = requireArg("--command");
  const runId = requireArg("--run-id");
  const evidenceRoot = path.resolve(requireArg("--evidence-root"));
  if (evidence !== path.join(evidenceRoot, feature, "proof.json")) {
    throw new Error(`evidence path must be ${path.join(evidenceRoot, feature, "proof.json")}`);
  }
  if (!scratch.startsWith("/tmp/verify-morpheum-sdk-ts-")) {
    throw new Error(`scratch must live under /tmp/verify-morpheum-sdk-ts-: ${scratch}`);
  }

  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(path.join(scratch, "marker.txt"), `${feature}\n`);

  const head = spawnSync("git", ["-C", repo, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  let exitCode = 0;
  let result: "PASS" | "FAIL" | "UNMET" = "FAIL";
  let observations: Record<string, unknown> = {};
  let error = "";
  try {
    observations = await DRIVES[feature as FeatureId](repo);
    result = "PASS";
    console.log(`PASS ${feature}`);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    if (caught instanceof UnmetPrecondition) {
      result = "UNMET";
      exitCode = 2;
    } else {
      exitCode = 1;
    }
    console.error(`${result} ${feature}: ${error}`);
  }

  const proof = {
    skill: "verify-morpheum-sdk-ts",
    feature,
    result,
    command,
    runId,
    repoHead: (head.stdout ?? "").trim(),
    finishedAt: new Date().toISOString(),
    observations,
    error,
  };
  writeProof(evidence, proof);
  const digest = createHash("sha256").update(fs.readFileSync(evidence)).digest("hex");
  console.log(`evidence ${evidence}`);
  console.log(`evidence-sha256 ${digest}`);
  return exitCode;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((caught) => {
    console.error(caught instanceof Error ? caught.message : String(caught));
    process.exitCode = 1;
  });
