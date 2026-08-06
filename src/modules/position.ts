/**
 * Position module — typed transaction builders for ClosePosition and UpdatePositionLeverage.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import {
  MsgClosePositionSchema,
  MsgUpdatePositionLeverageSchema,
} from "@morpheum/proto/position/v1/tx_pb";
import type { Tx } from "@morpheum/proto/tx/v1/tx_pb";
import { buildSignedTx } from "../tx-signed";
import { buildSignDoc, type SignDocResult } from "../sign-doc";

export interface PositionCloseParams {
  fromAddress: string;
  marketIndex: number;
  exitPrice: string;
  bucketId?: number;
}

export interface PositionUpdateLeverageParams {
  fromAddress: string;
  marketIndex: number;
  newLeverage: string;
  positionId?: string;
  bucketId?: string;
}

const CLOSE_POSITION_TYPE_URL = "/position.v1.Msg/ClosePosition";
const UPDATE_POSITION_LEVERAGE_TYPE_URL = "/position.v1.Msg/UpdatePositionLeverage";


export function encodeMsgClosePosition(
  params: PositionCloseParams,
): Uint8Array {
  const msg = create(MsgClosePositionSchema, {
    address: params.fromAddress,
    marketIndex: BigInt(params.marketIndex),
    exitPrice: BigInt(params.exitPrice),
    bucketId: BigInt(params.bucketId ?? 0),
  });
  return toBinary(MsgClosePositionSchema, msg);
}

export function encodeMsgUpdatePositionLeverage(
  params: PositionUpdateLeverageParams,
): Uint8Array {
  const msg = create(MsgUpdatePositionLeverageSchema, {
    address: params.fromAddress,
    positionId: params.positionId ?? "",
    bucketId: params.bucketId ?? "",
    marketIndex: BigInt(params.marketIndex),
    newLeverage: params.newLeverage,
  });
  return toBinary(MsgUpdatePositionLeverageSchema, msg);
}

export function buildPositionCloseSignDoc(
  params: PositionCloseParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgClosePosition(params);
  const signDoc = buildSignDoc(
    CLOSE_POSITION_TYPE_URL,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildPositionUpdateLeverageSignDoc(
  params: PositionUpdateLeverageParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgUpdatePositionLeverage(params);
  const signDoc = buildSignDoc(
    UPDATE_POSITION_LEVERAGE_TYPE_URL,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildPositionCloseSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  nonce: Uint8Array,
  memo: string = "",
): Tx {
  return buildSignedTx(
    CLOSE_POSITION_TYPE_URL,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    nonce,
    memo,
  );
}

export function buildPositionUpdateLeverageSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  nonce: Uint8Array,
  memo: string = "",
): Tx {
  return buildSignedTx(
    UPDATE_POSITION_LEVERAGE_TYPE_URL,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    nonce,
    memo,
  );
}
