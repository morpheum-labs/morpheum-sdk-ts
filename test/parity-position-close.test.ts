import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { create, fromBinary } from "@bufbuild/protobuf";
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
  buildPositionCloseSignDoc,
  encodeMsgClosePosition,
} from "../src/index";

type Fixture = {
  inputs: {
    signer: string;
    chainId: string;
    memo: string;
    genesisHashHex: string;
    nonce: { monotonic: string; tsMs: number; sub: number };
    marketIndex: number;
    exitPrice: string;
  };
  msgHex: string;
  signDocHex: string;
};

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "fixtures/parity/position-close.json",
    ),
    "utf8",
  ),
) as Fixture;

const params = {
  fromAddress: fixture.inputs.signer,
  marketIndex: fixture.inputs.marketIndex,
  exitPrice: fixture.inputs.exitPrice,
};

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function built() {
  return buildPositionCloseSignDoc(
    params,
    fixture.inputs.signer,
    ChainType.ETHEREUM,
    SignMode.EIP191_PERSONAL,
    {
      chainId: fixture.inputs.chainId,
      genesisHash: Buffer.from(fixture.inputs.genesisHashHex, "hex"),
    },
    fixture.inputs.memo,
    {
      nonce: create(NonceSchema, {
        monotonic: BigInt(fixture.inputs.nonce.monotonic),
        tsMs: fixture.inputs.nonce.tsMs,
        sub: fixture.inputs.nonce.sub,
      }),
    },
  );
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

function firstDiff(actual: Uint8Array, expected: Uint8Array): number {
  const n = Math.min(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    if (actual[i] !== expected[i]) return i;
  }
  return n;
}

function mismatch(actual: Uint8Array, expectedHex: string): string {
  const expected = new Uint8Array(Buffer.from(expectedHex, "hex"));
  const left = fields(actual);
  const right = fields(expected);
  const lines = left.flatMap(([name, value], index) => {
    const other = right[index]?.[1] ?? "";
    return value === other ? [] : [`${name} sdk-ts ${value} rust ${other}`];
  });
  return [
    `first differing byte ${firstDiff(actual, expected)}`,
    `sdk-ts length ${actual.length}`,
    `rust length ${expected.length}`,
    ...lines,
  ].join("\n");
}

describe("position-close parity", () => {
  it("message bytes match the Rust SDK", () => {
    assert.equal(hex(encodeMsgClosePosition(params)), fixture.msgHex);
  });

  it("SignDoc bytes match the Rust SDK", () => {
    const actual = built().signDocBytes;
    const actualHex = hex(actual);
    if (actualHex === fixture.signDocHex) return;
    assert.fail(mismatch(actual, fixture.signDocHex));
  });
});
