/**
 * FundingRate module — typed transaction builders for ApplyShardedFunding.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import {
  ApplyShardedFundingRequestSchema,
} from "@morpheum/proto/fundingrate/v1/tx_pb";
import { buildSignDocBytes } from "@morpheum/signing-node";
import type { Tx } from "@morpheum/proto/tx/v1/tx_pb";
import { buildSignedTx } from "../tx-signed";
import type { SignDocResult } from "./bucket";

const APPLY_SHARDED_FUNDING_TYPE_URL =
  "/fundingrate.v1.ApplyShardedFundingRequest";

export interface FundingPositionInput {
  address: string;
  positionId: string;
  size: string;
  entryPrice: string;
  isLong: boolean;
  leverage: string;
  power?: string;
  entriesCount?: number;
}

export interface FundingApplyShardedParams {
  shardId: string;
  marketIndex: number;
  rateSatoshi: string;
  logicalTimestamp: string;
  positions: FundingPositionInput[];
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

export function encodeMsgApplyShardedFunding(
  params: FundingApplyShardedParams,
): Uint8Array {
  return toBinary(
    ApplyShardedFundingRequestSchema,
    create(ApplyShardedFundingRequestSchema, {
      shardId: params.shardId,
      marketIndex: BigInt(params.marketIndex),
      rateSatoshi: BigInt(params.rateSatoshi),
      logicalTimestamp: BigInt(params.logicalTimestamp),
      positions: params.positions.map((position) => ({
        address: position.address,
        positionId: position.positionId,
        size: BigInt(position.size),
        entryPrice: BigInt(position.entryPrice),
        isLong: position.isLong,
        leverage: BigInt(position.leverage),
        power: BigInt(position.power ?? "1"),
        entriesCount: position.entriesCount ?? 1,
      })),
    }),
  );
}

export function buildFundingApplyShardedSignDoc(
  params: FundingApplyShardedParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgApplyShardedFunding(params);
  const signDoc = wasmSignDoc(
    APPLY_SHARDED_FUNDING_TYPE_URL,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildFundingApplyShardedSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  memo: string = "",
): Tx {
  return buildSignedTx(
    APPLY_SHARDED_FUNDING_TYPE_URL,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    memo,
  );
}
