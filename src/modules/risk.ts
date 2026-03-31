/**
 * Risk module — typed transaction builders for liquidation checks.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import { MsgLiquidationCheckSchema } from "@morpheum/proto/risk/v1/tx_pb";
import { buildSignDocBytes } from "@morpheum/signing-node";
import type { Tx } from "@morpheum/proto/tx/v1/tx_pb";
import { buildSignedTx } from "../tx-signed";
import type { SignDocResult } from "./bucket";

const LIQUIDATION_CHECK_TYPE_URL = "/risk.v1.MsgLiquidationCheck";

export interface RiskLiquidationCheckParams {
  marketIndex: number;
  markPrice: string;
  logicalTimestamp: string;
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

export function encodeMsgLiquidationCheck(
  params: RiskLiquidationCheckParams,
): Uint8Array {
  return toBinary(
    MsgLiquidationCheckSchema,
    create(MsgLiquidationCheckSchema, {
      marketIndex: BigInt(params.marketIndex),
      markPrice: BigInt(params.markPrice),
      logicalTimestamp: BigInt(params.logicalTimestamp),
    }),
  );
}

export function buildRiskLiquidationCheckSignDoc(
  params: RiskLiquidationCheckParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgLiquidationCheck(params);
  const signDoc = wasmSignDoc(
    LIQUIDATION_CHECK_TYPE_URL,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildRiskLiquidationCheckSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  memo: string = "",
): Tx {
  return buildSignedTx(
    LIQUIDATION_CHECK_TYPE_URL,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    memo,
  );
}
