/**
 * Risk module — typed transaction builders for permissionless liquidation triggers.
 *
 * `MsgTriggerLiquidation` is permissionless: any signer (keeper bot or user) may
 * request a liquidation scan for a market. The chain derives the current mark
 * price and logical timestamp deterministically from committed state, so the
 * message carries only the market and an optional bucket hint. A `bucketId` of
 * `"0"` requests a market-wide scan rather than a single-bucket check.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import { MsgTriggerLiquidationSchema } from "@morpheum/proto/risk/v1/tx_pb";
import { buildSignDocBytes } from "@morpheum/signing-node";
import type { Tx } from "@morpheum/proto/tx/v1/tx_pb";
import { buildSignedTx } from "../tx-signed";
import type { SignDocResult } from "./bucket";

const TRIGGER_LIQUIDATION_TYPE_URL = "/risk.v1.MsgTriggerLiquidation";

export interface RiskTriggerLiquidationParams {
  marketIndex: number;
  /** Target bucket id; `"0"` (default) requests a market-wide scan. */
  bucketId?: string;
}

function wasmSignDoc(
  typeUrl: string,
  msgBytes: Uint8Array,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string,
): SignDocResult {
  const result = buildSignDocBytes(
    typeUrl,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo || undefined,
    undefined,
  );
  return {
    signDocHash: result.signDocHash,
    signDocBytes: new Uint8Array(result.signDocBytes),
    bodyBytes: new Uint8Array(result.bodyBytes),
    authInfoBytes: new Uint8Array(result.authInfoBytes),
  };
}

export function encodeMsgTriggerLiquidation(
  params: RiskTriggerLiquidationParams,
): Uint8Array {
  return toBinary(
    MsgTriggerLiquidationSchema,
    create(MsgTriggerLiquidationSchema, {
      marketIndex: BigInt(params.marketIndex),
      bucketId: BigInt(params.bucketId ?? "0"),
    }),
  );
}

export function buildRiskTriggerLiquidationSignDoc(
  params: RiskTriggerLiquidationParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgTriggerLiquidation(params);
  const signDoc = wasmSignDoc(
    TRIGGER_LIQUIDATION_TYPE_URL,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildRiskTriggerLiquidationSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  memo: string = "",
): Tx {
  return buildSignedTx(
    TRIGGER_LIQUIDATION_TYPE_URL,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    memo,
  );
}
