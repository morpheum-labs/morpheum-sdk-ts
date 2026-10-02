/**
 * @morpheum/sdk — Morpheum TypeScript SDK
 *
 * Provides typed transaction builders, gRPC query client, and utilities
 * for interacting with the Morpheum chain from Node.js or browser environments.
 */

// WASM-backed SignDoc construction (single source of truth)
export { buildSignDocBytes } from "@morpheum/signing-node";

// Canonical SignDoc construction — the single place this SDK decides what a
// transaction's signature covers.
export {
  buildSignDoc,
  newNonce,
  type ChainIdentity,
  type SignDocOptions,
  type SignDocResult,
} from "./sign-doc";

// Tx assembly for gRPC submission, from the encodings a SignDoc builder
// returned — the only way this SDK assembles a signed transaction.
export { buildSignedTx } from "./tx-signed";

// Module-specific builders
export {
  type BucketCreateParams,
  type BucketTransferParams,
  type BucketTransferToBankParams,
  type BucketSetLeverageParams,
  encodeMsgCreateBucket,
  encodeMsgTransferBetweenBuckets,
  encodeMsgTransferToBank,
  encodeMsgSetLeverage,
  buildBucketCreateSignDoc,
  buildBucketTransferSignDoc,
  buildBucketTransferToBankSignDoc,
  buildBucketSetLeverageSignDoc,
} from "./modules/bucket";

export {
  type MarketActivateParams,
  type MarketCreateParams,
  type MarketParamsInput,
  type MarketSuspendParams,
  CLOB_ORDERBOOK,
  encodeMsgActivateMarket,
  encodeMsgCreateMarket,
  encodeMsgSuspendMarket,
  buildMarketActivateSignDoc,
  buildMarketCreateSignDoc,
  buildMarketSuspendSignDoc,
} from "./modules/market";

export {
  type ClobBatchOrderParams,
  type ClobPlaceBatchOrdersParams,
  type ClobPlaceOrderParams,
  type ClobModifyOrderParams,
  type ClobCancelOrderParams,
  type ClobProvideMarketMakerQuoteParams,
  type ClobCancelMarketMakerQuoteParams,
  encodeMsgPlaceBatchOrders,
  encodeMsgPlaceOrder,
  encodeMsgModifyOrder,
  encodeMsgCancelOrder,
  encodeMsgProvideMarketMakerQuote,
  encodeMsgCancelMarketMakerQuote,
  buildClobPlaceBatchOrdersSignDoc,
  buildClobPlaceOrderSignDoc,
  buildClobModifyOrderSignDoc,
  buildClobCancelOrderSignDoc,
  buildClobProvideMarketMakerQuoteSignDoc,
  buildClobCancelMarketMakerQuoteSignDoc,
} from "./modules/clob";

export {
  type PositionCloseParams,
  type PositionUpdateLeverageParams,
  encodeMsgClosePosition,
  encodeMsgUpdatePositionLeverage,
  buildPositionCloseSignDoc,
  buildPositionUpdateLeverageSignDoc,
} from "./modules/position";

export {
  type RiskTriggerLiquidationParams,
  encodeMsgTriggerLiquidation,
  buildRiskTriggerLiquidationSignDoc,
} from "./modules/risk";

// gRPC client
export {
  MormcoreGrpcClient,
  CONSENSUS_POLL_TIMEOUT_MS,
  type MormcoreGrpcClientOptions,
  type Tx,
  type SubmitTxResponse,
  type QueryTxResponse,
  type QueryTxStatusResponse,
  type QueryConsensusMetricsResponse,
  type QueryLatestTipsResponse,
  type Validator,
  type QueryValidatorsResponse,
  type Market,
  type QueryMarketResponse,
  type QueryMarketsResponse,
  type Bucket,
  type QueryBucketResponse,
  type QueryBucketsByAddressResponse,
  type QueryBucketStatusResponse,
  type QueryBalanceResponse,
  type Order,
  type MarketMakerQuote,
  type Position,
  type PositionState,
  type GetPositionResponse,
  type ListOpenPositionsResponse,
  type GetLongShortVolumeResponse,
  type QueryPositionsByAddressResponse,
  type QueryOrderbookSnapshotResponse,
  type QueryOrdersByMarketResponse,
  type QueryOrdersByAddressResponse,
  type QueryOrderByIdResponse,
  type QueryActiveMarketMakerQuotesResponse,
  type QueryMarketMakerQuoteByIdResponse,
} from "./grpc-client";

// Constants and enums
export {
  DEFAULT_CHAIN_ID,
  ChainType,
  Side,
  SignMode,
  BucketType,
  MarketType,
  OrderStatus,
  OrderType,
  TimeInForce,
} from "./utils/constants";

// Crypto utilities
export {
  parseEvmSignature,
  parseSolanaSignature,
  isValidEvmAddress,
  isValidSolanaAddress,
  isValidEvmSignature,
  isValidEd25519Signature,
} from "./utils/crypto";

// Solana utilities
export { base58Decode, base58ToHex } from "./utils/solana";

// WebSocket multiplex client
export {
  MorpheumWsClient,
  WsError,
  ChannelSpec,
  Subscription,
  AuthCredentials,
  type AuthResponse,
  type StreamEvent,
  type StreamTier,
  type WsClientConfig,
  type WebSocketConstructor,
  type WebSocketLike,
} from "./ws";
