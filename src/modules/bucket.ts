/**
 * Bucket module — typed transaction builders for CreateBucket,
 * TransferBetweenBuckets, and TransferToBank.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import {
  MsgCreateBucketRequestSchema,
  MsgTransferBetweenBucketsRequestSchema,
  MsgTransferToBankRequestSchema,
} from "@morpheum/proto/bucket/v1/tx_pb";
import { buildSignDocBytes } from "@morpheum/signing-node";
import { buildSignedTx } from "../tx-signed";
import type { Tx } from "@morpheum/proto/tx/v1/tx_pb";

export interface SignDocResult {
  signDocHash: string;
  signDocBytes: Uint8Array;
  bodyBytes: Uint8Array;
  authInfoBytes: Uint8Array;
}

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

const BUCKET_TX_PREFIX = "/bucket.v1.";

export function encodeMsgCreateBucket(params: BucketCreateParams): Uint8Array {
  const msg = create(MsgCreateBucketRequestSchema, {
    address: params.fromAddress,
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
    address: params.fromAddress,
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
    address: params.fromAddress,
    bucketId: params.bucketId,
    assetIndex: BigInt(params.assetIndex),
    amount: params.amount,
    fromAddress: params.fromAddress,
  });
  return toBinary(MsgTransferToBankRequestSchema, msg);
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

export function buildBucketCreateSignDoc(
  params: BucketCreateParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgCreateBucket(params);
  const signDoc = wasmSignDoc(
    `${BUCKET_TX_PREFIX}MsgCreateBucketRequest`,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildBucketTransferSignDoc(
  params: BucketTransferParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgTransferBetweenBuckets(params);
  const signDoc = wasmSignDoc(
    `${BUCKET_TX_PREFIX}MsgTransferBetweenBucketsRequest`,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildBucketTransferToBankSignDoc(
  params: BucketTransferToBankParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chainId: string,
  memo: string = "",
): SignDocResult & { msgBytes: Uint8Array } {
  const msgBytes = encodeMsgTransferToBank(params);
  const signDoc = wasmSignDoc(
    `${BUCKET_TX_PREFIX}MsgTransferToBankRequest`,
    msgBytes,
    signerAddress,
    chainType,
    signMode,
    chainId,
    memo,
  );
  return { ...signDoc, msgBytes };
}

export function buildBucketCreateSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  memo: string = "",
): Tx {
  return buildSignedTx(
    `${BUCKET_TX_PREFIX}MsgCreateBucketRequest`,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    memo,
  );
}

export function buildBucketTransferSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  memo: string = "",
): Tx {
  return buildSignedTx(
    `${BUCKET_TX_PREFIX}MsgTransferBetweenBucketsRequest`,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    memo,
  );
}

export function buildBucketTransferToBankSignedTx(
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  memo: string = "",
): Tx {
  return buildSignedTx(
    `${BUCKET_TX_PREFIX}MsgTransferToBankRequest`,
    msgBytes,
    signerAddress,
    signature,
    chainType,
    signMode,
    memo,
  );
}
