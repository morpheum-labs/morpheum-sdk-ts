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
