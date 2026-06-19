/**
 * Typed gRPC client for the Mormcore sentry node.
 *
 * Uses @connectrpc/connect with generated service descriptors from @morpheum/proto.
 * All response types come directly from the generated proto bindings (camelCase fields).
 */
import { createClient, type Client } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { IngressService } from "@morpheum/proto/tx/v1/ingress_pb";
import { Query as TxQuery } from "@morpheum/proto/tx/v1/query_pb";
import { Query as ConsensusQuery } from "@morpheum/proto/consensus/v1/query_pb";
import { Query as MarketQuery } from "@morpheum/proto/market/v1/query_pb";
import { Query as BucketQuery } from "@morpheum/proto/bucket/v1/query_pb";
import { Query as BankQuery } from "@morpheum/proto/bank/v1/query_pb";
import { Query as ClobQuery } from "@morpheum/proto/clob/v1/query_pb";
import { Query as PositionQuery } from "@morpheum/proto/position/v1/query_pb";
import { Query as StakingQuery } from "@morpheum/proto/staking/v1/query_pb";
import type { Tx } from "@morpheum/proto/tx/v1/tx_pb";
import type { SubmitTxResponse } from "@morpheum/proto/tx/v1/ingress_pb";
import type {
  QueryTxResponse,
  QueryTxStatusResponse,
} from "@morpheum/proto/tx/v1/query_pb";
import type {
  QueryConsensusMetricsResponse,
  QueryLatestTipsResponse,
} from "@morpheum/proto/consensus/v1/query_pb";
import type { Validator } from "@morpheum/proto/staking/v1/staking_pb";
import type { QueryValidatorsResponse } from "@morpheum/proto/staking/v1/query_pb";
import type {
  QueryMarketResponse,
  QueryMarketsResponse,
} from "@morpheum/proto/market/v1/query_pb";
import type { Market } from "@morpheum/proto/market/v1/market_pb";
import type { Bucket } from "@morpheum/proto/bucket/v1/bucket_pb";
import type {
  QueryBucketResponse,
  QueryBucketsByAddressResponse,
  QueryBucketStatusResponse,
} from "@morpheum/proto/bucket/v1/query_pb";
import type { QueryBalanceResponse } from "@morpheum/proto/bank/v1/query_pb";
import type { MarketMakerQuote, Order } from "@morpheum/proto/clob/v1/clob_pb";
import type { Position, PositionState } from "@morpheum/proto/position/v1/position_pb";
import type {
  QueryActiveMarketMakerQuotesResponse,
  QueryMarketMakerQuoteByIdResponse,
  QueryOrderbookSnapshotResponse,
  QueryOrdersByMarketResponse,
  QueryOrdersByAddressResponse,
  QueryOrderByIdResponse,
} from "@morpheum/proto/clob/v1/query_pb";
import type {
  GetLongShortVolumeResponse,
  GetPositionResponse,
  ListOpenPositionsResponse,
  QueryPositionsByAddressResponse,
} from "@morpheum/proto/position/v1/query_pb";

export const CONSENSUS_POLL_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHexAddress(address: string): string {
  return /^0x[0-9a-fA-F]+$/.test(address) ? address.toLowerCase() : address;
}

export interface MormcoreGrpcClientOptions {
  baseUrl: string;
  ensureTransport?: () => Promise<void>;
}

export class MormcoreGrpcClient {
  private readonly ingressClient: Client<typeof IngressService>;
  private readonly txClient: Client<typeof TxQuery>;
  private readonly consensusClient: Client<typeof ConsensusQuery>;
  private readonly marketClient: Client<typeof MarketQuery>;
  private readonly bucketClient: Client<typeof BucketQuery>;
  private readonly bankClient: Client<typeof BankQuery>;
  private readonly clobClient: Client<typeof ClobQuery>;
  private readonly positionClient: Client<typeof PositionQuery>;
  private readonly stakingClient: Client<typeof StakingQuery>;
  private readonly ensureTransport?: () => Promise<void>;

  constructor(options: MormcoreGrpcClientOptions) {
    this.ensureTransport = options.ensureTransport;
    const transport = createGrpcTransport({
      baseUrl: options.baseUrl,
    });
    this.ingressClient = createClient(IngressService, transport);
    this.txClient = createClient(TxQuery, transport);
    this.consensusClient = createClient(ConsensusQuery, transport);
    this.marketClient = createClient(MarketQuery, transport);
    this.bucketClient = createClient(BucketQuery, transport);
    this.bankClient = createClient(BankQuery, transport);
    this.clobClient = createClient(ClobQuery, transport);
    this.positionClient = createClient(PositionQuery, transport);
    this.stakingClient = createClient(StakingQuery, transport);
  }

  close(): void {
    // Connect transports are stateless; no explicit close needed.
  }

  private async ensureReady(): Promise<void> {
    if (this.ensureTransport) await this.ensureTransport();
  }

  // -- Transaction Submission --

  async submitTx(tx: Tx): Promise<SubmitTxResponse> {
    await this.ensureReady();
    return this.ingressClient.submitTx({ tx });
  }

  async queryTx(txhash: string): Promise<QueryTxResponse> {
    await this.ensureReady();
    return this.txClient.queryTx({ txhash });
  }

  async queryTxStatus(txhash: string): Promise<QueryTxStatusResponse> {
    await this.ensureReady();
    return this.txClient.queryTxStatus({ txhash });
  }

  // -- Network KPI Queries (read-only) --

  /** Validator set (`staking.v1.Query/QueryValidators`); pass `activeOnly` for the live set. */
  async queryValidators(
    options: { activeOnly?: boolean; limit?: number; offset?: number } = {},
  ): Promise<QueryValidatorsResponse> {
    await this.ensureReady();
    return this.stakingClient.queryValidators({
      activeOnly: options.activeOnly ?? false,
      limit: options.limit ?? 0,
      offset: options.offset ?? 0,
    });
  }

  /** Aggregate consensus metrics (`consensus.v1.Query/QueryConsensusMetrics`). */
  async queryConsensusMetrics(): Promise<QueryConsensusMetricsResponse> {
    await this.ensureReady();
    return this.consensusClient.queryConsensusMetrics({});
  }

  /** Latest blocklace tips across all shards (`consensus.v1.Query/QueryLatestTips`). */
  async queryLatestTips(): Promise<QueryLatestTipsResponse> {
    await this.ensureReady();
    return this.consensusClient.queryLatestTips({});
  }

  // -- Market Queries --

  async queryMarket(marketIndex: number): Promise<QueryMarketResponse> {
    await this.ensureReady();
    return this.marketClient.queryMarket({ marketIndex: BigInt(marketIndex) });
  }

  async queryMarkets(limit: number = 1000): Promise<QueryMarketsResponse> {
    await this.ensureReady();
    return this.marketClient.queryMarkets({ limit, offset: 0 });
  }

  // -- Bucket Queries --

  async queryBucket(bucketId: string): Promise<QueryBucketResponse> {
    await this.ensureReady();
    return this.bucketClient.getBucket({ bucketId });
  }

  async queryBucketsByAddress(
    address: string,
  ): Promise<QueryBucketsByAddressResponse> {
    await this.ensureReady();
    return this.bucketClient.getBucketsByAddress({ address });
  }

  async queryBucketStatus(
    address: string,
    bucketId: string,
  ): Promise<QueryBucketStatusResponse> {
    await this.ensureReady();
    return this.bucketClient.queryBucketStatus({ address, bucketId });
  }

  async queryBankBalance(
    address: string,
    assetIndex: number,
  ): Promise<QueryBalanceResponse> {
    await this.ensureReady();
    return this.bankClient.queryBalance({
      address,
      assetIndex: BigInt(assetIndex),
    });
  }

  // -- CLOB Queries --

  async queryOrderbookSnapshot(
    marketIndex: number,
    depth: number = 50,
  ): Promise<QueryOrderbookSnapshotResponse> {
    await this.ensureReady();
    return this.clobClient.queryOrderBookSnapshot({
      marketIndex: BigInt(marketIndex),
      depth,
    });
  }

  async queryOrdersByAddress(
    address: string,
    options: { marketIndex?: number; status?: number } = {},
  ): Promise<QueryOrdersByAddressResponse> {
    await this.ensureReady();
    return this.clobClient.queryOrdersByAddress({
      address,
      marketIndex:
        options.marketIndex === undefined ? undefined : BigInt(options.marketIndex),
      status: options.status,
    });
  }

  async queryOrdersByMarket(
    marketIndex: number,
    options: { status?: number; side?: number } = {},
  ): Promise<QueryOrdersByMarketResponse> {
    await this.ensureReady();
    return this.clobClient.queryOrdersByMarket({
      marketIndex: BigInt(marketIndex),
      status: options.status,
      side: options.side,
    });
  }

  async queryOrderById(
    orderId: string,
    address: string,
  ): Promise<QueryOrderByIdResponse> {
    await this.ensureReady();
    return this.clobClient.queryOrderById({ orderId, address });
  }

  async queryActiveMarketMakerQuotes(
    poolId: string,
    options: { marketIndex?: number; side?: number; status?: string } = {},
  ): Promise<QueryActiveMarketMakerQuotesResponse> {
    await this.ensureReady();
    return this.clobClient.queryActiveMarketMakerQuotes({
      poolId,
      marketIndex:
        options.marketIndex === undefined ? undefined : BigInt(options.marketIndex),
      side: options.side,
      status: options.status,
    });
  }

  async queryMarketMakerQuoteById(
    quoteId: string,
  ): Promise<QueryMarketMakerQuoteByIdResponse> {
    await this.ensureReady();
    return this.clobClient.queryMarketMakerQuoteById({ quoteId });
  }

  // -- Position Queries --

  async queryPosition(
    address: string,
    marketIndex: number,
  ): Promise<GetPositionResponse> {
    await this.ensureReady();
    return this.positionClient.getPosition({
      address: normalizeHexAddress(address),
      marketIndex: BigInt(marketIndex),
    });
  }

  async queryListOpenPositions(
    address: string,
  ): Promise<ListOpenPositionsResponse> {
    await this.ensureReady();
    return this.positionClient.listOpenPositions({
      address: normalizeHexAddress(address),
    });
  }

  async queryLongShortVolume(
    marketIndex: number,
  ): Promise<GetLongShortVolumeResponse> {
    await this.ensureReady();
    return this.positionClient.getLongShortVolume({
      marketIndex: BigInt(marketIndex),
    });
  }

  async queryPositionsByAddress(
    address: string,
    activeOnly: boolean = true,
  ): Promise<QueryPositionsByAddressResponse> {
    await this.ensureReady();
    return this.positionClient.queryPositionsByAddress({
      address: normalizeHexAddress(address),
      activeOnly,
    });
  }

  // -- Polling Helpers --

  async pollUntilMarketExists(
    baseAsset: number,
    quoteAsset: number,
    timeoutMs: number = CONSENSUS_POLL_TIMEOUT_MS,
  ): Promise<Market> {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryMarkets(1000);
        if (resp.success && resp.markets) {
          const match = resp.markets.find(
            (m) =>
              Number(m.baseAssetIndex) === baseAsset &&
              Number(m.quoteAssetIndex) === quoteAsset,
          );
          if (match) return match;
        }
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Market (base=${baseAsset}, quote=${quoteAsset}) did not appear after ${attempts} attempts (${timeoutMs}ms timeout)`,
    );
  }

  async pollUntilBucketExists(
    bucketId: string,
    timeoutMs: number = CONSENSUS_POLL_TIMEOUT_MS,
  ): Promise<Bucket> {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryBucket(bucketId);
        if (resp.success && resp.bucket) return resp.bucket;
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Bucket '${bucketId}' did not appear after ${attempts} attempts (${timeoutMs}ms timeout)`,
    );
  }

  async pollUntilBucketMarginEquals(
    bucketId: string,
    expectedMargin: string,
    timeoutMs: number = CONSENSUS_POLL_TIMEOUT_MS,
  ): Promise<Bucket> {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastSeen = "<unseen>";
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryBucket(bucketId);
        if (resp.success && resp.bucket) {
          lastSeen = resp.bucket.depositedMargin;
          if (resp.bucket.depositedMargin === expectedMargin)
            return resp.bucket;
        }
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Bucket '${bucketId}' did not reach depositedMargin='${expectedMargin}' after ${attempts} attempts (${timeoutMs}ms timeout). Last seen='${lastSeen}'`,
    );
  }

  async pollUntilBankBalanceEquals(
    address: string,
    assetIndex: number,
    expectedBalance: string,
    timeoutMs: number = CONSENSUS_POLL_TIMEOUT_MS,
  ): Promise<QueryBalanceResponse> {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastSeen = "<unseen>";
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryBankBalance(address, assetIndex);
        lastSeen = resp.balance;
        if (resp.balance === expectedBalance) return resp;
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Bank balance for '${address}' asset=${assetIndex} did not reach '${expectedBalance}' after ${attempts} attempts (${timeoutMs}ms timeout). Last seen='${lastSeen}'`,
    );
  }

  async pollUntilOrderbookLevelQuantity(
    marketIndex: number,
    side: "bids" | "asks",
    price: string,
    expectedQuantity: string,
    timeoutMs: number = CONSENSUS_POLL_TIMEOUT_MS,
  ): Promise<QueryOrderbookSnapshotResponse> {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastSeen = "<missing>";
    while (Date.now() < deadline) {
      attempts++;
      try {
        const snapshot = await this.queryOrderbookSnapshot(marketIndex, 50);
        const level = snapshot[side].find((entry) => entry.price === price);
        const effectiveQuantity = level?.quantity ?? "0";
        lastSeen = effectiveQuantity;
        if (effectiveQuantity === expectedQuantity) return snapshot;
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Orderbook ${side} level ${price} for market=${marketIndex} did not reach quantity='${expectedQuantity}' after ${attempts} attempts (${timeoutMs}ms timeout). Last seen='${lastSeen}'`,
    );
  }

  async pollUntilOrderAppears(
    address: string,
    options: {
      marketIndex: number;
      side: number;
      price: string;
      quantity: string;
      timeoutMs?: number;
    },
  ): Promise<Order> {
    const timeoutMs = options.timeoutMs ?? CONSENSUS_POLL_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryOrdersByAddress(address, {
          marketIndex: options.marketIndex,
        });
        const match = resp.orders.find(
          (order) =>
            Number(order.marketIndex) === options.marketIndex &&
            Number(order.side) === options.side &&
            order.price === options.price &&
            order.quantity === options.quantity,
        );
        if (match) return match;
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Order for address='${address}' market=${options.marketIndex} side=${options.side} price='${options.price}' quantity='${options.quantity}' did not appear after ${attempts} attempts (${timeoutMs}ms timeout)`,
    );
  }

  async pollUntilOrderMatches(
    orderId: string,
    address: string,
    options: {
      price?: string;
      quantity?: string;
      status?: number;
      timeoutMs?: number;
    } = {},
  ): Promise<Order> {
    const timeoutMs = options.timeoutMs ?? CONSENSUS_POLL_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastSeen = "<unseen>";
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryOrderById(orderId, address);
        const order = resp.order;
        if (order) {
          lastSeen = `price=${order.price} qty=${order.quantity} status=${Number(order.status)}`;
          const priceMatches =
            options.price === undefined || order.price === options.price;
          const quantityMatches =
            options.quantity === undefined || order.quantity === options.quantity;
          const statusMatches =
            options.status === undefined || Number(order.status) === options.status;
          if (priceMatches && quantityMatches && statusMatches) return order;
        }
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Order '${orderId}' for address='${address}' did not match expected fields after ${attempts} attempts (${timeoutMs}ms timeout). Last seen='${lastSeen}'`,
    );
  }

  async pollUntilOrderAbsent(
    orderId: string,
    address: string,
    marketIndex: number,
    timeoutMs: number = CONSENSUS_POLL_TIMEOUT_MS,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastSeen = "<present>";
    while (Date.now() < deadline) {
      attempts++;
      try {
        const byId = await this.queryOrderById(orderId, address);
        const byMarket = await this.queryOrdersByMarket(marketIndex);
        const inOrderList = byMarket.orders.some((order) => order.orderId === orderId);
        if (!byId.order && !inOrderList) return;
        if (byId.order) {
          lastSeen = `price=${byId.order.price} qty=${byId.order.quantity} status=${Number(byId.order.status)}`;
        } else {
          lastSeen = "<still-listed-in-market-query>";
        }
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Order '${orderId}' for address='${address}' market=${marketIndex} did not disappear after ${attempts} attempts (${timeoutMs}ms timeout). Last seen='${lastSeen}'`,
    );
  }

  async pollUntilActiveQuoteAppears(
    poolId: string,
    options: {
      marketIndex: number;
      side: number;
      price: string;
      excludeQuoteIds?: string[];
      timeoutMs?: number;
    },
  ): Promise<MarketMakerQuote> {
    const timeoutMs = options.timeoutMs ?? CONSENSUS_POLL_TIMEOUT_MS;
    const excludeQuoteIds = options.excludeQuoteIds ?? [];
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryActiveMarketMakerQuotes(poolId, {
          marketIndex: options.marketIndex,
        });
        const match = resp.quotes.find(
          (quote) =>
            Number(quote.marketIndex) === options.marketIndex &&
            Number(quote.side) === options.side &&
            quote.price === options.price &&
            !excludeQuoteIds.includes(quote.quoteId),
        );
        if (match) return match;
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Active quote for pool='${poolId}' market=${options.marketIndex} side=${options.side} price='${options.price}' did not appear after ${attempts} attempts (${timeoutMs}ms timeout)`,
    );
  }

  async pollUntilActiveQuoteAbsent(
    poolId: string,
    quoteId: string,
    options: { marketIndex?: number; timeoutMs?: number } = {},
  ): Promise<void> {
    const timeoutMs = options.timeoutMs ?? CONSENSUS_POLL_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastSeen = "<present>";
    while (Date.now() < deadline) {
      attempts++;
      try {
        const active = await this.queryActiveMarketMakerQuotes(poolId, {
          marketIndex: options.marketIndex,
        });
        const stillActive = active.quotes.some((quote) => quote.quoteId === quoteId);
        if (!stillActive) return;
        lastSeen = "<still-active>";
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Active quote '${quoteId}' for pool='${poolId}' did not disappear after ${attempts} attempts (${timeoutMs}ms timeout). Last seen='${lastSeen}'`,
    );
  }

  async pollUntilPositionAppears(
    address: string,
    options: {
      marketIndex: number;
      bucketId?: string;
      timeoutMs?: number;
    },
  ): Promise<Position> {
    const timeoutMs = options.timeoutMs ?? CONSENSUS_POLL_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryPositionsByAddress(address, true);
        const match = resp.positions.find(
          (position) =>
            Number(position.marketIndex) === options.marketIndex &&
            (options.bucketId === undefined || position.bucketId === options.bucketId),
        );
        if (match) return match;
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Position for address='${address}' market=${options.marketIndex} bucket='${options.bucketId ?? "<any>"}' did not appear after ${attempts} attempts (${timeoutMs}ms timeout)`,
    );
  }

  async pollUntilPositionLeverage(
    address: string,
    options: {
      positionId: string;
      expectedLeverage: string;
      timeoutMs?: number;
    },
  ): Promise<Position> {
    const timeoutMs = options.timeoutMs ?? CONSENSUS_POLL_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastSeen = "<unseen>";
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryPositionsByAddress(address, false);
        const match = resp.positions.find(
          (position) => position.positionId === options.positionId,
        );
        if (match) {
          lastSeen = `leverage=${match.leverage} size=${match.size} bucket=${match.bucketId}`;
          if (match.leverage === options.expectedLeverage) return match;
        }
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Position '${options.positionId}' for address='${address}' did not reach leverage='${options.expectedLeverage}' after ${attempts} attempts (${timeoutMs}ms timeout). Last seen='${lastSeen}'`,
    );
  }

  async pollUntilPositionStateLeverage(
    address: string,
    marketIndex: number,
    expectedLeverage: number,
    timeoutMs: number = CONSENSUS_POLL_TIMEOUT_MS,
  ): Promise<PositionState> {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastSeen = "<unseen>";
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryPosition(address, marketIndex);
        if (resp.position) {
          lastSeen = String(resp.position.leverage);
          if (Number(resp.position.leverage) === expectedLeverage) return resp.position;
        }
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Position state for address='${address}' market=${marketIndex} did not reach leverage=${expectedLeverage} after ${attempts} attempts (${timeoutMs}ms timeout). Last seen='${lastSeen}'`,
    );
  }

  async pollUntilPositionStateAbsent(
    address: string,
    marketIndex: number,
    timeoutMs: number = CONSENSUS_POLL_TIMEOUT_MS,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastSeen = "<present>";
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryPosition(address, marketIndex);
        if (!resp.found || !resp.position) return;
        lastSeen = `leverage=${resp.position.leverage} size=${resp.position.size} bucket=${resp.position.bucketId}`;
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Position state for address='${address}' market=${marketIndex} did not disappear after ${attempts} attempts (${timeoutMs}ms timeout). Last seen='${lastSeen}'`,
    );
  }

  async pollUntilPositionByIdAbsent(
    address: string,
    positionId: string,
    timeoutMs: number = CONSENSUS_POLL_TIMEOUT_MS,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let lastSeen = "<present>";
    while (Date.now() < deadline) {
      attempts++;
      try {
        const resp = await this.queryPositionsByAddress(address, false);
        const match = resp.positions.find(
          (position) => position.positionId === positionId,
        );
        if (!match) return;
        lastSeen = `market=${Number(match.marketIndex)} leverage=${match.leverage} size=${match.size} bucket=${match.bucketId}`;
      } catch {
        /* gRPC may fail briefly during consensus */
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
      `Position '${positionId}' for address='${address}' did not disappear after ${attempts} attempts (${timeoutMs}ms timeout). Last seen='${lastSeen}'`,
    );
  }
}

// Re-export generated proto types for consumer convenience
export type { Tx } from "@morpheum/proto/tx/v1/tx_pb";
export type { SubmitTxResponse } from "@morpheum/proto/tx/v1/ingress_pb";
export type {
  QueryTxResponse,
  QueryTxStatusResponse,
} from "@morpheum/proto/tx/v1/query_pb";
export type {
  QueryConsensusMetricsResponse,
  QueryLatestTipsResponse,
} from "@morpheum/proto/consensus/v1/query_pb";
export type { Validator } from "@morpheum/proto/staking/v1/staking_pb";
export type { QueryValidatorsResponse } from "@morpheum/proto/staking/v1/query_pb";
export type { Market } from "@morpheum/proto/market/v1/market_pb";
export type {
  QueryMarketResponse,
  QueryMarketsResponse,
} from "@morpheum/proto/market/v1/query_pb";
export type { Bucket } from "@morpheum/proto/bucket/v1/bucket_pb";
export type {
  QueryBucketResponse,
  QueryBucketsByAddressResponse,
  QueryBucketStatusResponse,
} from "@morpheum/proto/bucket/v1/query_pb";
export type { QueryBalanceResponse } from "@morpheum/proto/bank/v1/query_pb";
export type { MarketMakerQuote, Order } from "@morpheum/proto/clob/v1/clob_pb";
export type { Position, PositionState } from "@morpheum/proto/position/v1/position_pb";
export type {
  QueryActiveMarketMakerQuotesResponse,
  QueryMarketMakerQuoteByIdResponse,
  QueryOrderbookSnapshotResponse,
  QueryOrdersByMarketResponse,
  QueryOrdersByAddressResponse,
  QueryOrderByIdResponse,
} from "@morpheum/proto/clob/v1/query_pb";
export type {
  GetLongShortVolumeResponse,
  GetPositionResponse,
  ListOpenPositionsResponse,
  QueryPositionsByAddressResponse,
} from "@morpheum/proto/position/v1/query_pb";
