/**
 * Market module — typed transaction builders for CreateMarket, ActivateMarket, and SuspendMarket.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import {
  MsgActivateMarketRequestSchema,
  MsgCreateMarketRequestSchema,
  MsgSuspendMarketRequestSchema,
} from "@morpheum/proto/market/v1/tx_pb";
import { buildSignedTx } from "../tx-signed";
import { buildSignDoc, type SignDocResult } from "../sign-doc";
import type { Tx } from "@morpheum/proto/tx/v1/tx_pb";

export interface MarketParamsInput {
  minOrderSize: string;
  tickSize?: string;
  lotSize?: string;
  maxLeverage?: string;
  initialMarginRatio?: string;
  maintenanceMarginRatio?: string;
  allowMarketOrders?: boolean;
  allowStopOrders?: boolean;
}

export interface MarketCreateParams {
  fromAddress: string;
  baseAssetIndex: number;
  quoteAssetIndex: number;
  marketType: number;
  orderbookType: string;
  params: MarketParamsInput;
}

export interface MarketActivateParams {
  activator: string;
  marketIndex: number;
}

export interface MarketSuspendParams {
  suspender: string;
  marketIndex: number;
  reason: string;
}

const CREATE_MARKET_TYPE_URL = "/market.v1.MsgCreateMarketRequest";
const ACTIVATE_MARKET_TYPE_URL = "/market.v1.MsgActivateMarketRequest";
const SUSPEND_MARKET_TYPE_URL = "/market.v1.MsgSuspendMarketRequest";

export function encodeMsgCreateMarket(params: MarketCreateParams): Uint8Array {
  const msg = create(MsgCreateMarketRequestSchema, {
    fromAddress: params.fromAddress,
    baseAssetIndex: BigInt(params.baseAssetIndex),
    quoteAssetIndex: BigInt(params.quoteAssetIndex),
    marketType: params.marketType,
    orderbookType: params.orderbookType,
    params: {
      minOrderSize: params.params.minOrderSize,
      tickSize: params.params.tickSize ?? "",
      lotSize: params.params.lotSize ?? "",
      maxLeverage: params.params.maxLeverage ?? "",
      initialMarginRatio: params.params.initialMarginRatio ?? "",
      maintenanceMarginRatio: params.params.maintenanceMarginRatio ?? "",
      allowMarketOrders: params.params.allowMarketOrders ?? false,
      allowStopOrders: params.params.allowStopOrders ?? false,
    },
  });
  return toBinary(MsgCreateMarketRequestSchema, msg);
}

export function encodeMsgActivateMarket(
  params: MarketActivateParams,
): Uint8Array {
  const msg = create(MsgActivateMarketRequestSchema, {
    marketIndex: BigInt(params.marketIndex),
    activator: params.activator,
  });
  return toBinary(MsgActivateMarketRequestSchema, msg);
}

export function encodeMsgSuspendMarket(
  params: MarketSuspendParams,
): Uint8Array {
  const msg = create(MsgSuspendMarketRequestSchema, {
    marketIndex: BigInt(params.marketIndex),
    reason: params.reason,
    suspender: params.suspender,
  });
  return toBinary(MsgSuspendMarketRequestSchema, msg);
}


export function buildMarketCreateSignDoc(
  params: MarketCreateParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgCreateMarket(params);
  const signDoc = buildSignDoc(
    CREATE_MARKET_TYPE_URL,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildMarketActivateSignDoc(
  params: MarketActivateParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgActivateMarket(params);
  const signDoc = buildSignDoc(
    ACTIVATE_MARKET_TYPE_URL,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildMarketSuspendSignDoc(
  params: MarketSuspendParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgSuspendMarket(params);
  const signDoc = buildSignDoc(
    SUSPEND_MARKET_TYPE_URL,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildMarketCreateSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  nonce: Uint8Array,
  memo: string = "",
): Tx {
  return buildSignedTx(
    CREATE_MARKET_TYPE_URL,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    nonce,
    memo,
  );
}

export function buildMarketActivateSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  nonce: Uint8Array,
  memo: string = "",
): Tx {
  return buildSignedTx(
    ACTIVATE_MARKET_TYPE_URL,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    nonce,
    memo,
  );
}

export function buildMarketSuspendSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  nonce: Uint8Array,
  memo: string = "",
): Tx {
  return buildSignedTx(
    SUSPEND_MARKET_TYPE_URL,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    nonce,
    memo,
  );
}
