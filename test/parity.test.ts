import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { create, fromBinary } from "@bufbuild/protobuf";
import { BucketType } from "@morpheum/proto/bucket/v1/bucket_pb";
import { OrderType } from "@morpheum/proto/clob/v1/clob_pb";
import { Side } from "@morpheum/proto/primitives/v1/primitives_pb";
import {
  AuthInfoSchema,
  NonceSchema,
  SignDocSchema,
  TxBodySchema,
  type SignerInfo,
} from "@morpheum/proto/tx/v1/tx_pb";
import {
  ChainType,
  SignMode,
  buildBucketCreateSignDoc,
  buildClobCancelOrderSignDoc,
  buildClobPlaceOrderSignDoc,
  buildPositionCloseSignDoc,
  buildPositionUpdateLeverageSignDoc,
  buildRiskTriggerLiquidationSignDoc,
  encodeMsgCancelOrder,
  encodeMsgClosePosition,
  encodeMsgCreateBucket,
  encodeMsgPlaceOrder,
  encodeMsgTriggerLiquidation,
  encodeMsgUpdatePositionLeverage,
  type ChainIdentity,
  type SignDocOptions,
  type SignDocResult,
} from "../src/index";

const RUST_SDK_SHA = "e64030e184aa68e20dd67caf8908ab1e2f635348";

type Envelope = {
  signer: string;
  chainType: ChainType;
  signMode: SignMode;
  chain: ChainIdentity;
  memo: string;
  options: SignDocOptions;
};

type Expected = { name: string; msgHex: string; signDocHex: string };

type Verdict = "match" | "finding";

type Builder<P> = (
  params: P,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo?: string,
  options?: SignDocOptions,
) => SignDocResult;

type CaseSpec<P> = {
  name: string;
  verdict: Verdict;
  params: (signer: string) => P;
  encode: (params: P) => Uint8Array;
  build: Builder<P>;
};

type Case = {
  name: string;
  verdict: Verdict;
  bytes(envelope: Envelope): { msg: Uint8Array; signDoc: Uint8Array };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`signdocs.json ${key} must be a string`);
  }
  return value;
}

function enumByName<E extends Record<string, number | string>>(
  kind: string,
  members: E,
  name: string,
): E[keyof E] & number {
  if (!Object.hasOwn(members, name)) {
    throw new Error(`unknown ${kind} ${name}`);
  }
  const value = members[name as keyof E];
  if (typeof value !== "number") {
    throw new Error(`unknown ${kind} ${name}`);
  }
  return value;
}

function parseFixture(raw: unknown): {
  envelope: Envelope;
  expected: readonly Expected[];
} {
  if (!isRecord(raw)) {
    throw new Error("signdocs.json is not an object");
  }
  if (raw.rustSdkSha !== RUST_SDK_SHA) {
    throw new Error(`rustSdkSha ${String(raw.rustSdkSha)} != ${RUST_SDK_SHA}`);
  }
  if (!isRecord(raw.envelope)) {
    throw new Error("signdocs.json envelope is missing");
  }
  const env = raw.envelope;
  if (!isRecord(env.nonce)) {
    throw new Error("signdocs.json nonce is missing");
  }
  const monotonic = env.nonce.monotonic;
  const tsMs = env.nonce.tsMs;
  const sub = env.nonce.sub;
  if (typeof monotonic !== "string") {
    throw new Error("signdocs.json nonce.monotonic must be a string");
  }
  if (typeof tsMs !== "number") {
    throw new Error("signdocs.json nonce.tsMs must be a number");
  }
  if (typeof sub !== "number") {
    throw new Error("signdocs.json nonce.sub must be a number");
  }
  if (!Array.isArray(raw.cases)) {
    throw new Error("signdocs.json cases must be an array");
  }
  const expected = raw.cases.map((entry, index): Expected => {
    if (!isRecord(entry)) {
      throw new Error(`signdocs.json cases[${index}] is not an object`);
    }
    return {
      name: requiredString(entry, "name"),
      msgHex: requiredString(entry, "msgHex"),
      signDocHex: requiredString(entry, "signDocHex"),
    };
  });
  return {
    envelope: {
      signer: requiredString(env, "signer"),
      chainType: enumByName("chainType", ChainType, requiredString(env, "chainType")),
      signMode: enumByName("signMode", SignMode, requiredString(env, "signMode")),
      chain: {
        chainId: requiredString(env, "chainId"),
        genesisHash: Buffer.from(requiredString(env, "genesisHashHex"), "hex"),
      },
      memo: requiredString(env, "memo"),
      options: {
        nonce: create(NonceSchema, {
          monotonic: BigInt(monotonic),
          tsMs,
          sub,
        }),
      },
    },
    expected,
  };
}

function parityCase<P>(spec: CaseSpec<P>): Case {
  return {
    name: spec.name,
    verdict: spec.verdict,
    bytes(envelope) {
      const params = spec.params(envelope.signer);
      const built = spec.build(
        params,
        envelope.signer,
        envelope.chainType,
        envelope.signMode,
        envelope.chain,
        envelope.memo,
        envelope.options,
      );
      return { msg: spec.encode(params), signDoc: built.signDocBytes };
    },
  };
}

const CASES: readonly Case[] = [
  parityCase({
    name: "position-close",
    verdict: "match",
    params: (signer) => ({
      fromAddress: signer,
      marketIndex: 0,
      exitPrice: "100",
    }),
    encode: encodeMsgClosePosition,
    build: buildPositionCloseSignDoc,
  }),
  parityCase({
    name: "position-update-leverage",
    verdict: "match",
    params: (signer) => ({
      fromAddress: signer,
      marketIndex: 1,
      newLeverage: "5",
      positionId: "3",
      bucketId: "7",
    }),
    encode: encodeMsgUpdatePositionLeverage,
    build: buildPositionUpdateLeverageSignDoc,
  }),
  parityCase({
    name: "risk-trigger-liquidation",
    verdict: "match",
    params: () => ({ marketIndex: 1, bucketId: "7" }),
    encode: encodeMsgTriggerLiquidation,
    build: buildRiskTriggerLiquidationSignDoc,
  }),
  parityCase({
    name: "bucket-create",
    verdict: "match",
    params: (signer) => {
      const chainMintedBucketId = "";
      return {
        fromAddress: signer,
        bucketId: chainMintedBucketId,
        bucketType: BucketType.ISOLATED,
        collateralAssetIndex: 0,
        initialMargin: "100",
      };
    },
    encode: encodeMsgCreateBucket,
    build: buildBucketCreateSignDoc,
  }),
  parityCase({
    name: "clob-place-order",
    verdict: "match",
    params: (signer) => ({
      fromAddress: signer,
      marketIndex: 0,
      price: "100",
      quantity: "1",
      side: Side.BUY,
      orderType: OrderType.LIMIT,
    }),
    encode: encodeMsgPlaceOrder,
    build: buildClobPlaceOrderSignDoc,
  }),
  parityCase({
    name: "clob-cancel-order",
    verdict: "match",
    params: (signer) => ({ fromAddress: signer, orderId: "order-1" }),
    encode: encodeMsgCancelOrder,
    build: buildClobCancelOrderSignDoc,
  }),
];

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function fromHex(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "hex"));
}

function sameBytes(actual: Uint8Array, expected: Uint8Array): boolean {
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

function firstDiff(actual: Uint8Array, expected: Uint8Array): number {
  const n = Math.min(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    if (actual[i] !== expected[i]) return i;
  }
  return n;
}

function signMode(info: SignerInfo | undefined): string {
  const sum = info?.modeInfo?.sum;
  if (sum?.case !== "single") return "";
  return String(sum.value.mode);
}

function fields(bytes: Uint8Array): Array<[string, string]> {
  const signDoc = fromBinary(SignDocSchema, bytes);
  const auth = fromBinary(AuthInfoSchema, signDoc.authInfoBytes);
  const info = auth.signerInfos[0];
  const message = fromBinary(TxBodySchema, signDoc.bodyBytes).messages[0];
  return [
    ["messageTypeUrl", message?.typeUrl ?? ""],
    ["messageHex", message ? hex(message.value) : ""],
    ["publicKeyTypeUrl", info?.publicKey?.typeUrl ?? ""],
    ["publicKeyHex", info?.publicKey ? hex(info.publicKey.value) : ""],
    ["signMode", signMode(info)],
    ["chainType", String(info?.chainType ?? "")],
    ["gasLimit", auth.gasLimit.toString()],
    ["chainId", signDoc.chainId],
    ["accountNumber", signDoc.accountNumber.toString()],
    ["genesisHashHex", hex(signDoc.genesisHash)],
    ["monotonic", signDoc.nonce?.monotonic.toString() ?? ""],
    ["tsMs", String(signDoc.nonce?.tsMs ?? "")],
    ["sub", String(signDoc.nonce?.sub ?? "")],
  ];
}

function field(rows: Array<[string, string]>, name: string): string {
  const row = rows.find(([key]) => key === name);
  if (!row) throw new Error(`missing field ${name}`);
  return row[1];
}

function sideIdentity(bytes: Uint8Array): {
  publicKeyTypeUrl: string;
  chainType: string;
} {
  try {
    const rows = fields(bytes);
    return {
      publicKeyTypeUrl: field(rows, "publicKeyTypeUrl"),
      chainType: field(rows, "chainType"),
    };
  } catch {
    return { publicKeyTypeUrl: "undecodable", chainType: "undecodable" };
  }
}

function identityLines(sdk: Uint8Array, rust: Uint8Array): string[] {
  const left = sideIdentity(sdk);
  const right = sideIdentity(rust);
  return [
    `publicKeyTypeUrl sdk-ts ${left.publicKeyTypeUrl} rust ${right.publicKeyTypeUrl}`,
    `chainType sdk-ts ${left.chainType} rust ${right.chainType}`,
  ];
}

function otherFieldDiffs(sdk: Uint8Array, rust: Uint8Array): string[] {
  let left: Array<[string, string]>;
  let right: Array<[string, string]>;
  try {
    left = fields(sdk);
    right = fields(rust);
  } catch {
    return [];
  }
  return left.flatMap(([name, value], index) => {
    if (name === "publicKeyTypeUrl" || name === "chainType") return [];
    const other = right[index]?.[1] ?? "";
    return value === other ? [] : [`${name} sdk-ts ${value} rust ${other}`];
  });
}

function byteHeader(actual: Uint8Array, expected: Uint8Array): string[] {
  return [
    `first differing byte ${firstDiff(actual, expected)}`,
    `sdk-ts length ${actual.length}`,
    `rust length ${expected.length}`,
  ];
}

function compareMsg(
  actual: Uint8Array,
  expectedHex: string,
  sdkSignDoc: Uint8Array,
  rustSignDocHex: string,
): string | null {
  const expected = fromHex(expectedHex);
  if (sameBytes(actual, expected)) return null;
  return [
    ...byteHeader(actual, expected),
    ...identityLines(sdkSignDoc, fromHex(rustSignDocHex)),
  ].join("\n");
}

function compareSignDoc(actual: Uint8Array, expectedHex: string): string | null {
  const expected = fromHex(expectedHex);
  if (sameBytes(actual, expected)) return null;
  return [
    ...byteHeader(actual, expected),
    ...identityLines(actual, expected),
    ...otherFieldDiffs(actual, expected),
  ].join("\n");
}

function loadFixture(): unknown {
  const file = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "fixtures/parity/signdocs.json",
  );
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

describe("SignDoc parity with the Rust SDK", () => {
  const { envelope, expected } = parseFixture(loadFixture());

  it("cases follow the generator's order", () => {
    assert.deepEqual(
      CASES.map((c) => c.name),
      expected.map((c) => c.name),
    );
  });

  it("a finding ends the batch", () => {
    const index = CASES.findIndex((c) => c.verdict === "finding");
    assert.ok(index === -1 || index === CASES.length - 1);
  });

  for (const [index, c] of CASES.entries()) {
    describe(c.name, () => {
      const check = c.verdict === "match" ? it : it.todo;
      check("message bytes match the Rust SDK", () => {
        const want = expected[index];
        assert.ok(want, `missing fixture case ${c.name}`);
        const { msg, signDoc } = c.bytes(envelope);
        const report = compareMsg(msg, want.msgHex, signDoc, want.signDocHex);
        if (report) assert.fail(report);
      });
      check("SignDoc bytes match the Rust SDK", () => {
        const want = expected[index];
        assert.ok(want, `missing fixture case ${c.name}`);
        const report = compareSignDoc(c.bytes(envelope).signDoc, want.signDocHex);
        if (report) assert.fail(report);
      });
    });
  }
});
