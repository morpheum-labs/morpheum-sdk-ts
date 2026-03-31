/**
 * Domain types for the Morpheum multiplex WebSocket client.
 *
 * Provides channel specifications, authentication credentials, configuration,
 * and the StreamEvent payload delivered to subscription consumers.
 *
 * Mirrors morpheum-sdk/crates/ws/src/types.rs.
 */

// ---------------------------------------------------------------------------
// StreamTier
// ---------------------------------------------------------------------------

export type StreamTier = "free" | "basic" | "premium" | "rawcore";

// ---------------------------------------------------------------------------
// ChannelSpec
// ---------------------------------------------------------------------------

export interface ChannelSpecData {
  type: string;
  coin?: string;
  symbols?: string[];
  interval?: string;
  depth?: number;
  agent_id?: string;
  address?: string;
}

/**
 * Specifies a streaming channel to subscribe to.
 *
 * Constructed via typed static factory methods for well-known channels, or
 * `ChannelSpec.custom()` for arbitrary / future channels.
 */
export class ChannelSpec {
  readonly type: string;
  readonly coin?: string;
  readonly symbols?: string[];
  readonly interval?: string;
  readonly depth?: number;
  readonly agentId?: string;
  readonly address?: string;

  private constructor(data: {
    type: string;
    coin?: string;
    symbols?: string[];
    interval?: string;
    depth?: number;
    agentId?: string;
    address?: string;
  }) {
    this.type = data.type;
    this.coin = data.coin;
    this.symbols = data.symbols;
    this.interval = data.interval;
    this.depth = data.depth;
    this.agentId = data.agentId;
    this.address = data.address;
  }

  /** Canonical key used internally to route incoming server frames. */
  get routingKey(): string {
    let key = this.type;
    if (this.coin != null) key += `:${this.coin}`;
    if (this.agentId != null) key += `:${this.agentId}`;
    if (this.address != null) key += `:${this.address}`;
    if (this.interval != null) key += `:${this.interval}`;
    return key;
  }

  /** Serialize to the wire format expected by the server's SubscriptionSpec. */
  toWire(): ChannelSpecData {
    const wire: ChannelSpecData = { type: this.type };
    if (this.coin != null) wire.coin = this.coin;
    if (this.symbols != null) wire.symbols = this.symbols;
    if (this.interval != null) wire.interval = this.interval;
    if (this.depth != null) wire.depth = this.depth;
    if (this.agentId != null) wire.agent_id = this.agentId;
    if (this.address != null) wire.address = this.address;
    return wire;
  }

  // -- helpers ---------------------------------------------------------------

  private static withCoin(channelType: string, coin?: string): ChannelSpec {
    return new ChannelSpec({ type: channelType, coin });
  }

  private static bare(channelType: string): ChannelSpec {
    return new ChannelSpec({ type: channelType });
  }

  // -- market data -----------------------------------------------------------

  static allMids(): ChannelSpec {
    return ChannelSpec.bare("allMids");
  }

  static l2Book(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("l2Book", coin);
  }

  static l2BookDepth(coin: string, depth: number): ChannelSpec {
    return new ChannelSpec({ type: "l2Book", coin, depth });
  }

  static trades(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("trades", coin);
  }

  static bbo(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("bbo", coin);
  }

  static candle(coin: string, interval: string): ChannelSpec {
    return new ChannelSpec({ type: "candle", coin, interval });
  }

  static activeAssetCtx(): ChannelSpec {
    return ChannelSpec.bare("activeAssetCtx");
  }

  // -- price / oracle --------------------------------------------------------

  static priceFeed(symbols: string[]): ChannelSpec {
    return new ChannelSpec({ type: "priceFeed", symbols });
  }

  static markPrice(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("markPrice", coin);
  }

  static fundingRate(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("fundingRate", coin);
  }

  static twap(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("twap", coin);
  }

  /** Lowercase alias accepted by the subscribe-only WS endpoint. */
  static markprice(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("markprice", coin);
  }

  /** Lowercase alias accepted by the subscribe-only WS endpoint. */
  static fundingrate(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("fundingrate", coin);
  }

  /** Lowercase alias accepted by the subscribe-only WS endpoint. */
  static kline(coin?: string, interval?: string): ChannelSpec {
    return new ChannelSpec({ type: "kline", coin, interval });
  }

  // -- CLOB / exchange -------------------------------------------------------

  static clob(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("clob", coin);
  }

  static risk(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("risk", coin);
  }

  static position(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("position", coin);
  }

  static bucket(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("bucket", coin);
  }

  static balances(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("balances", coin);
  }

  static market(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("market", coin);
  }

  // -- DeFi modules ----------------------------------------------------------

  static vault(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("vault", coin);
  }

  static treasury(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("treasury", coin);
  }

  static vesting(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("vesting", coin);
  }

  static token(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("token", coin);
  }

  static insurance(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("insurance", coin);
  }

  static staking(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("staking", coin);
  }

  static clamm(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("clamm", coin);
  }

  static clammGrad(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("clammgrad", coin);
  }

  static bondingCurve(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("bondingcurve", coin);
  }

  // -- governance ------------------------------------------------------------

  static governance(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("governance", coin);
  }

  static dao(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("dao", coin);
  }

  static upgrade(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("upgrade", coin);
  }

  // -- prediction / outcome --------------------------------------------------

  static prediction(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("prediction", coin);
  }

  static outcomeFeed(coin?: string): ChannelSpec {
    return ChannelSpec.withCoin("outcomeFeed", coin);
  }

  static osa(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("osa", coin);
  }

  // -- agent / AI pillar -----------------------------------------------------

  static agentState(agentId: string): ChannelSpec {
    return new ChannelSpec({ type: "agentState", agentId });
  }

  static agentreg(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("agentreg", coin);
  }

  static identity(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("identity", coin);
  }

  static reputation(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("reputation", coin);
  }

  static validation(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("validation", coin);
  }

  static memory(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("memory", coin);
  }

  static job(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("job", coin);
  }

  static intent(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("intent", coin);
  }

  static directory(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("directory", coin);
  }

  static vc(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("vc", coin);
  }

  static marketplace(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("marketplace", coin);
  }

  static inferreg(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("inferreg", coin);
  }

  // -- cross-chain / payments ------------------------------------------------

  static interop(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("interop", coin);
  }

  static x402(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("x402", coin);
  }

  // -- infrastructure --------------------------------------------------------

  static consensus(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("consensus", coin);
  }

  static authChannel(coin: string): ChannelSpec {
    return ChannelSpec.withCoin("auth", coin);
  }

  // -- user-specific ---------------------------------------------------------

  static userFills(address: string): ChannelSpec {
    return new ChannelSpec({ type: "userFills", address });
  }

  static orderUpdates(address: string): ChannelSpec {
    return new ChannelSpec({ type: "orderUpdates", address });
  }

  static userFundings(address: string): ChannelSpec {
    return new ChannelSpec({ type: "userFundings", address });
  }

  static clearinghouseState(address: string): ChannelSpec {
    return new ChannelSpec({ type: "clearinghouseState", address });
  }

  static openOrders(address: string): ChannelSpec {
    return new ChannelSpec({ type: "openOrders", address });
  }

  // -- generic ---------------------------------------------------------------

  static custom(channelType: string): ChannelSpec {
    return ChannelSpec.bare(channelType);
  }

  /** Return a copy with a coin filter attached. */
  withCoinFilter(coin: string): ChannelSpec {
    return new ChannelSpec({ ...this.toInternal(), coin });
  }

  /** Return a copy with an agent_id filter attached. */
  withAgentId(agentId: string): ChannelSpec {
    return new ChannelSpec({ ...this.toInternal(), agentId });
  }

  /** Return a copy with a user address filter attached. */
  withAddress(address: string): ChannelSpec {
    return new ChannelSpec({ ...this.toInternal(), address });
  }

  private toInternal() {
    return {
      type: this.type,
      coin: this.coin,
      symbols: this.symbols,
      interval: this.interval,
      depth: this.depth,
      agentId: this.agentId,
      address: this.address,
    };
  }
}

// ---------------------------------------------------------------------------
// AuthCredentials
// ---------------------------------------------------------------------------

export interface AuthCredentials {
  tier: StreamTier;
  signature?: string;
  agentId?: string;
}

export const AuthCredentials = {
  free(): AuthCredentials {
    return { tier: "free" };
  },
  basic(signature: string, agentId: string): AuthCredentials {
    return { tier: "basic", signature, agentId };
  },
  premium(signature: string, agentId: string): AuthCredentials {
    return { tier: "premium", signature, agentId };
  },
  rawCore(signature: string, agentId: string): AuthCredentials {
    return { tier: "rawcore", signature, agentId };
  },
} as const;

// ---------------------------------------------------------------------------
// AuthResponse
// ---------------------------------------------------------------------------

export interface AuthResponse {
  tier: StreamTier;
  receiptId?: string;
}

// ---------------------------------------------------------------------------
// StreamEvent
// ---------------------------------------------------------------------------

export interface StreamEvent {
  channel: string;
  data: unknown;
  isSnapshot: boolean;
}

// ---------------------------------------------------------------------------
// WsClientConfig
// ---------------------------------------------------------------------------

/**
 * Minimal WebSocket interface consumed by MorpheumWsClient.
 * Satisfied by both browser `WebSocket` and the `ws` npm package.
 */
export interface WebSocketLike {
  readonly readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketConstructor = new (url: string) => WebSocketLike;

export interface WsClientConfig {
  url: string;
  autoAuth?: AuthCredentials;
  bufferCapacity?: number;
  /** Inject a WebSocket constructor (defaults to globalThis.WebSocket). */
  WebSocketCtor?: WebSocketConstructor;
}
