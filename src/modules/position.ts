/**
 * Position module — typed transaction builders for ClosePosition and UpdatePositionLeverage.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import {
  MsgClosePositionSchema,
  MsgUpdatePositionLeverageSchema,
} from "@morpheum/proto/position/v1/tx_pb";
import {
  buildSignDoc,
  type ChainIdentity,
  type SignDocOptions,
  type SignDocResult,
} from "../sign-doc";

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
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    CLOSE_POSITION_TYPE_URL,
    encodeMsgClosePosition(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}

export function buildPositionUpdateLeverageSignDoc(
  params: PositionUpdateLeverageParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    UPDATE_POSITION_LEVERAGE_TYPE_URL,
    encodeMsgUpdatePositionLeverage(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}
