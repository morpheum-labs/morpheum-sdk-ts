/**
 * Kline module — typed transaction builders for ProcessTrade.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import { ProcessTradeRequestSchema } from "@morpheum/proto/kline/v1/tx_pb";
import { buildSignDocBytes } from "@morpheum/signing-node";
import type { Tx } from "@morpheum/proto/tx/v1/tx_pb";
import { buildSignedTx } from "../tx-signed";
import type { SignDocResult } from "./bucket";

const PROCESS_TRADE_TYPE_URL = "/kline.v1.ProcessTradeRequest";

export interface KlineProcessTradeParams {
  marketIndex: number;
  price: string;
  quantity: string;
  isTakerBuy: boolean;
  blockHeight: string;
  logicalTimestamp: string;
  feedId?: string;
  outcomeId?: number;
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

export function encodeMsgProcessTrade(
  params: KlineProcessTradeParams,
): Uint8Array {
  return toBinary(
    ProcessTradeRequestSchema,
    create(ProcessTradeRequestSchema, {
      trade: {
        marketIndex: BigInt(params.marketIndex),
        price: BigInt(params.price),
        quantity: params.quantity,
        isTakerBuy: params.isTakerBuy,
        blockHeight: BigInt(params.blockHeight),
        logicalTimestamp: BigInt(params.logicalTimestamp),
        feedId: params.feedId ?? "",
        outcomeId: params.outcomeId ?? 0,
      },
    }),
  );
}

export function buildKlineProcessTradeSignDoc(
  params: KlineProcessTradeParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgProcessTrade(params);
  const signDoc = wasmSignDoc(
    PROCESS_TRADE_TYPE_URL,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildKlineProcessTradeSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  memo: string = "",
): Tx {
  return buildSignedTx(
    PROCESS_TRADE_TYPE_URL,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    memo,
  );
}
