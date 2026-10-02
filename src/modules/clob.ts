/**
 * CLOB module — typed transaction builders for PlaceOrder and ModifyOrder.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import {
  MsgCancelMarketMakerQuoteRequestSchema,
  MsgCancelOrderRequestSchema,
  MsgModifyOrderRequestSchema,
  MsgPlaceBatchOrdersRequestSchema,
  MsgPlaceOrderRequestSchema,
  MsgProvideMarketMakerQuoteRequestSchema,
} from "@morpheum/proto/clob/v1/tx_pb";
import {
  DurationSchema,
  TimestampSchema,
  type Duration,
} from "@bufbuild/protobuf/wkt";
import { keccak256 } from "ethers";
import {
  buildSignDoc,
  type ChainIdentity,
  type SignDocOptions,
  type SignDocResult,
} from "../sign-doc";

export interface ClobPlaceOrderParams {
  fromAddress: string;
  marketIndex: number;
  price: string;
  quantity: string;
  side: number;
  orderType: number;
  clientOrderId?: string;
  leverage?: string;
  takeProfit?: string;
  stopLoss?: string;
  timeInForce?: number;
  postOnly?: boolean;
  hidden?: boolean;
  displayQuantity?: string;
  reduceOnly?: boolean;
  bucketId?: string;
}

export interface ClobBatchOrderParams {
  marketIndex: number;
  price: string;
  quantity: string;
  side: number;
  orderType: number;
  clientOrderId?: string;
  leverage?: string;
  takeProfit?: string;
  stopLoss?: string;
  timeInForce?: number;
  postOnly?: boolean;
  hidden?: boolean;
  displayQuantity?: string;
  reduceOnly?: boolean;
  bucketId?: string;
}

export interface ClobModifyOrderParams {
  fromAddress: string;
  orderId: string;
  symbol?: string;
  newPrice?: string;
  newQuantity?: string;
}

export interface ClobCancelOrderParams {
  fromAddress: string;
  orderId: string;
  symbol?: string;
}

export interface ClobProvideMarketMakerQuoteParams {
  provider: string;
  poolId: string;
  marketIndex: number;
  side: number;
  price: string;
  amount: string;
  durationSeconds?: number;
  providerExternalAddress?: string;
}

export interface ClobCancelMarketMakerQuoteParams {
  quoteId: string;
  provider: string;
}

const PLACE_ORDER_TYPE_URL = "/clob.v1.MsgPlaceOrderRequest";
const PLACE_BATCH_ORDERS_TYPE_URL = "/clob.v1.MsgPlaceBatchOrdersRequest";
const MODIFY_ORDER_TYPE_URL = "/clob.v1.MsgModifyOrderRequest";
const CANCEL_ORDER_TYPE_URL = "/clob.v1.MsgCancelOrderRequest";
const PROVIDE_MARKET_MAKER_QUOTE_TYPE_URL =
  "/clob.v1.MsgProvideMarketMakerQuoteRequest";
const CANCEL_MARKET_MAKER_QUOTE_TYPE_URL =
  "/clob.v1.MsgCancelMarketMakerQuoteRequest";

export interface ClobPlaceBatchOrdersParams {
  fromAddress: string;
  orders: ClobBatchOrderParams[];
  ordersHash?: string;
}

function createBatchOrderMessage(
  fromAddress: string,
  params: ClobBatchOrderParams,
  timestampSeconds: number,
) {
  return {
    address: fromAddress,
    marketIndex: BigInt(params.marketIndex),
    price: params.price,
    quantity: params.quantity,
    side: params.side,
    orderType: params.orderType,
    clientOrderId: params.clientOrderId ?? "",
    leverage: params.leverage ?? "",
    takeProfit: params.takeProfit ?? "",
    stopLoss: params.stopLoss ?? "",
    timeInForce: params.timeInForce ?? 1,
    postOnly: params.postOnly ?? false,
    hidden: params.hidden ?? false,
    displayQuantity: params.displayQuantity ?? "",
    reduceOnly: params.reduceOnly ?? false,
    bucketId: params.bucketId ?? "",
    timestamp: create(TimestampSchema, {
      seconds: BigInt(timestampSeconds),
      nanos: 0,
    }),
  };
}

function formatRfc3339(seconds: number): string {
  return new Date(seconds * 1000).toISOString().replace(".000Z", "Z");
}

function createBatchOrderHashMessage(
  fromAddress: string,
  params: ClobBatchOrderParams,
  timestampRfc3339: string,
) {
  const message: Record<string, string | number | boolean> = {
    address: fromAddress,
    marketIndex: params.marketIndex,
    price: params.price === "" ? "0" : params.price,
    quantity: params.quantity,
    side: params.side,
    orderType: params.orderType,
    timestamp: timestampRfc3339,
    timeInForce: params.timeInForce ?? 1,
  };
  if (params.leverage && params.leverage !== "") message.leverage = params.leverage;
  if (params.postOnly) message.postOnly = true;
  if (params.reduceOnly) message.reduceOnly = true;
  if (params.bucketId && params.bucketId !== "") message.bucketId = params.bucketId;
  return message;
}

function computeOrdersHash(
  fromAddress: string,
  orders: ClobBatchOrderParams[],
  timestampSeconds: number,
): string {
  const timestampRfc3339 = formatRfc3339(timestampSeconds);
  const orderMessages = orders.map((order) =>
    createBatchOrderHashMessage(fromAddress, order, timestampRfc3339),
  );
  const encoded = new TextEncoder().encode(JSON.stringify(orderMessages));
  return keccak256(encoded);
}

export function encodeMsgPlaceOrder(params: ClobPlaceOrderParams): Uint8Array {
  const msg = create(MsgPlaceOrderRequestSchema, {
    address: params.fromAddress,
    marketIndex: BigInt(params.marketIndex),
    price: params.price,
    quantity: params.quantity,
    side: params.side,
    orderType: params.orderType,
    clientOrderId: params.clientOrderId ?? "",
    leverage: params.leverage ?? "",
    takeProfit: params.takeProfit ?? "",
    stopLoss: params.stopLoss ?? "",
    timeInForce: params.timeInForce ?? 1,
    postOnly: params.postOnly ?? false,
    hidden: params.hidden ?? false,
    displayQuantity: params.displayQuantity ?? "",
    reduceOnly: params.reduceOnly ?? false,
    bucketId: params.bucketId ?? "",
  });
  return toBinary(MsgPlaceOrderRequestSchema, msg);
}

export function encodeMsgPlaceBatchOrders(
  params: ClobPlaceBatchOrdersParams,
): Uint8Array {
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const msg = create(MsgPlaceBatchOrdersRequestSchema, {
    fromAddress: params.fromAddress,
    orders: params.orders.map((order) =>
      createBatchOrderMessage(params.fromAddress, order, timestampSeconds),
    ),
    ordersHash:
      params.ordersHash && params.ordersHash.length > 0
        ? params.ordersHash
        : computeOrdersHash(params.fromAddress, params.orders, timestampSeconds),
  });
  return toBinary(MsgPlaceBatchOrdersRequestSchema, msg);
}


export function buildClobPlaceOrderSignDoc(
  params: ClobPlaceOrderParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    PLACE_ORDER_TYPE_URL,
    encodeMsgPlaceOrder(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}

export function buildClobPlaceBatchOrdersSignDoc(
  params: ClobPlaceBatchOrdersParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    PLACE_BATCH_ORDERS_TYPE_URL,
    encodeMsgPlaceBatchOrders(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}

export function encodeMsgModifyOrder(params: ClobModifyOrderParams): Uint8Array {
  const msg = create(MsgModifyOrderRequestSchema, {
    address: params.fromAddress,
    orderId: params.orderId,
    symbol: params.symbol ?? "",
    newPrice: params.newPrice ?? "",
    newQuantity: params.newQuantity ?? "",
  });
  return toBinary(MsgModifyOrderRequestSchema, msg);
}

export function buildClobModifyOrderSignDoc(
  params: ClobModifyOrderParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    MODIFY_ORDER_TYPE_URL,
    encodeMsgModifyOrder(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}

export function encodeMsgCancelOrder(params: ClobCancelOrderParams): Uint8Array {
  const msg = create(MsgCancelOrderRequestSchema, {
    address: params.fromAddress,
    orderId: params.orderId,
    symbol: params.symbol ?? "",
  });
  return toBinary(MsgCancelOrderRequestSchema, msg);
}

function createDuration(seconds?: number): Duration | undefined {
  if (seconds === undefined) return undefined;
  return create(DurationSchema, {
    seconds: BigInt(seconds),
    nanos: 0,
  });
}

export function encodeMsgProvideMarketMakerQuote(
  params: ClobProvideMarketMakerQuoteParams,
): Uint8Array {
  const msg = create(MsgProvideMarketMakerQuoteRequestSchema, {
    poolId: params.poolId,
    marketIndex: BigInt(params.marketIndex),
    side: params.side,
    price: params.price,
    amount: params.amount,
    duration: createDuration(params.durationSeconds),
    providerExternalAddress: params.providerExternalAddress,
    provider: params.provider,
  });
  return toBinary(MsgProvideMarketMakerQuoteRequestSchema, msg);
}

export function encodeMsgCancelMarketMakerQuote(
  params: ClobCancelMarketMakerQuoteParams,
): Uint8Array {
  const msg = create(MsgCancelMarketMakerQuoteRequestSchema, {
    quoteId: params.quoteId,
    provider: params.provider,
  });
  return toBinary(MsgCancelMarketMakerQuoteRequestSchema, msg);
}

export function buildClobCancelOrderSignDoc(
  params: ClobCancelOrderParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    CANCEL_ORDER_TYPE_URL,
    encodeMsgCancelOrder(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}

export function buildClobProvideMarketMakerQuoteSignDoc(
  params: ClobProvideMarketMakerQuoteParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    PROVIDE_MARKET_MAKER_QUOTE_TYPE_URL,
    encodeMsgProvideMarketMakerQuote(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}

export function buildClobCancelMarketMakerQuoteSignDoc(
  params: ClobCancelMarketMakerQuoteParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
  options: SignDocOptions = {},
): SignDocResult {
  return buildSignDoc(
    CANCEL_MARKET_MAKER_QUOTE_TYPE_URL,
    encodeMsgCancelMarketMakerQuote(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
    options,
  );
}
