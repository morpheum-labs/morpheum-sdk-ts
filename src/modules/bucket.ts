/**
 * Bucket module — typed transaction builders for CreateBucket,
 * TransferBetweenBuckets, and TransferToBank.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import {
  MsgCreateBucketRequestSchema,
  MsgSetLeverageSchema,
  MsgTransferBetweenBucketsRequestSchema,
  MsgTransferToBankRequestSchema,
} from "@morpheum/proto/bucket/v1/tx_pb";
import {
  buildSignDoc,
  type ChainIdentity,
  type SignDocOptions,
  type SignDocResult,
} from "../sign-doc";


export interface BucketCreateParams {
  fromAddress: string;
  bucketId: string;
  bucketType: number;
  collateralAssetIndex: number;
  initialMargin: string;
}

export interface BucketTransferParams {
  fromAddress: string;
  sourceBucketId: string;
  targetBucketId: string;
  amount: string;
  reason?: string;
}

export interface BucketTransferToBankParams {
  fromAddress: string;
  bucketId: string;
  assetIndex: number;
  amount: string;
}

export interface BucketSetLeverageParams {
  fromAddress: string;
  bucketId: string;
  marketIndex: number;
  leverage: number;
}

const BUCKET_TX_PREFIX = "/bucket.v1.";

export function encodeMsgCreateBucket(params: BucketCreateParams): Uint8Array {
  const msg = create(MsgCreateBucketRequestSchema, {
    bucketId: params.bucketId,
    bucketType: params.bucketType,
    collateralAssetIndex: BigInt(params.collateralAssetIndex),
    initialMargin: params.initialMargin,
  });
  return toBinary(MsgCreateBucketRequestSchema, msg);
}

export function encodeMsgTransferBetweenBuckets(
  params: BucketTransferParams,
): Uint8Array {
  const msg = create(MsgTransferBetweenBucketsRequestSchema, {
    sourceBucketId: params.sourceBucketId,
    targetBucketId: params.targetBucketId,
    amount: params.amount,
    reason: params.reason ?? "",
  });
  return toBinary(MsgTransferBetweenBucketsRequestSchema, msg);
}

export function encodeMsgTransferToBank(
  params: BucketTransferToBankParams,
): Uint8Array {
  const msg = create(MsgTransferToBankRequestSchema, {
    bucketId: params.bucketId,
    assetIndex: BigInt(params.assetIndex),
    amount: params.amount,
  });
  return toBinary(MsgTransferToBankRequestSchema, msg);
}

export function encodeMsgSetLeverage(
  params: BucketSetLeverageParams,
): Uint8Array {
  const msg = create(MsgSetLeverageSchema, {
    bucketId: params.bucketId,
    marketIndex: BigInt(params.marketIndex),
    leverage: params.leverage,
  });
  return toBinary(MsgSetLeverageSchema, msg);
}


export function buildBucketCreateSignDoc(
  params: BucketCreateParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    `${BUCKET_TX_PREFIX}MsgCreateBucketRequest`,
    encodeMsgCreateBucket(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}

export function buildBucketTransferSignDoc(
  params: BucketTransferParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    `${BUCKET_TX_PREFIX}MsgTransferBetweenBucketsRequest`,
    encodeMsgTransferBetweenBuckets(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}

export function buildBucketTransferToBankSignDoc(
  params: BucketTransferToBankParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    `${BUCKET_TX_PREFIX}MsgTransferToBankRequest`,
    encodeMsgTransferToBank(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}

export function buildBucketSetLeverageSignDoc(
  params: BucketSetLeverageParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    `${BUCKET_TX_PREFIX}MsgSetLeverage`,
    encodeMsgSetLeverage(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}
