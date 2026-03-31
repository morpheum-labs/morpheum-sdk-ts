/**
 * Subscribe-only multiplex WebSocket client for the Morpheum streaming layer.
 *
 * Mirrors morpheum-sdk/crates/ws/src/client.rs + connection.rs.
 *
 * A single WebSocket connection is shared across all subscriptions. Incoming
 * data frames are routed to the matching Subscription via routing keys.
 */

import type {
  AuthCredentials,
  AuthResponse,
  ChannelSpec,
  StreamEvent,
  WebSocketConstructor,
  WebSocketLike,
  WsClientConfig,
} from "./types";
import {
  decodeServerMessage,
  encodeAuth,
  encodeSubscribe,
  encodeUnsubscribe,
} from "./protocol";
import { Subscription } from "./subscription";

const DEFAULT_BUFFER_CAPACITY = 256;

export class WsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WsError";
  }
}

interface PendingResolvers<T> {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

/**
 * Subscribe-only multiplex WebSocket client.
 *
 * Lifecycle: connect -> authenticate -> subscribe/unsubscribe -> close.
 */
export class MorpheumWsClient {
  private _ws: WebSocketLike | null = null;
  private _connected = false;
  private readonly _config: WsClientConfig;

  private _pendingAuth: PendingResolvers<AuthResponse> | null = null;
  private readonly _pendingSubscribes = new Map<
    string,
    PendingResolvers<void>
  >();
  private readonly _pendingUnsubscribes = new Map<
    string,
    PendingResolvers<void>
  >();
  private readonly _subscriptions = new Map<string, Subscription>();
  private readonly _snapshotSent = new Set<string>();

  private constructor(config: WsClientConfig) {
    this._config = config;
  }

  get connected(): boolean {
    return this._connected;
  }

  // -----------------------------------------------------------------------
  // Static factory
  // -----------------------------------------------------------------------

  static async connect(config: WsClientConfig): Promise<MorpheumWsClient> {
    const client = new MorpheumWsClient(config);
    await client._open();
    if (config.autoAuth) {
      await client.authenticate(config.autoAuth);
    }
    return client;
  }

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  async authenticate(credentials: AuthCredentials): Promise<AuthResponse> {
    this._requireOpen();
    return new Promise<AuthResponse>((resolve, reject) => {
      this._pendingAuth = { resolve, reject };
      this._ws!.send(encodeAuth(credentials));
    });
  }

  // -----------------------------------------------------------------------
  // Subscribe / Unsubscribe
  // -----------------------------------------------------------------------

  async subscribe(spec: ChannelSpec): Promise<Subscription> {
    this._requireOpen();
    const key = spec.routingKey;

    const existing = this._subscriptions.get(key);
    if (existing && !existing.closed) return existing;

    const capacity = this._config.bufferCapacity ?? DEFAULT_BUFFER_CAPACITY;
    const subscription = new Subscription(spec, capacity);
    this._subscriptions.set(key, subscription);

    await new Promise<void>((resolve, reject) => {
      this._pendingSubscribes.set(key, { resolve, reject });
      this._ws!.send(encodeSubscribe(spec));
    });

    return subscription;
  }

  async subscribeMany(specs: ChannelSpec[]): Promise<Subscription[]> {
    const promises = specs.map((s) => this.subscribe(s));
    return Promise.all(promises);
  }

  async unsubscribe(spec: ChannelSpec): Promise<void> {
    this._requireOpen();
    const key = spec.routingKey;

    await new Promise<void>((resolve, reject) => {
      this._pendingUnsubscribes.set(key, { resolve, reject });
      this._ws!.send(encodeUnsubscribe(spec));
    });

    const sub = this._subscriptions.get(key);
    if (sub) {
      sub.close();
      this._subscriptions.delete(key);
      this._snapshotSent.delete(key);
    }
  }

  // -----------------------------------------------------------------------
  // Close
  // -----------------------------------------------------------------------

  close(): void {
    if (!this._ws) return;
    this._connected = false;
    try {
      this._ws.close(1000, "client close");
    } catch {
      // Ignore errors if already closed.
    }
    this._teardown();
  }

  // -----------------------------------------------------------------------
  // Internal: open the WebSocket
  // -----------------------------------------------------------------------

  private _open(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const Ctor: WebSocketConstructor =
        this._config.WebSocketCtor ??
        (globalThis as unknown as { WebSocket: WebSocketConstructor }).WebSocket;

      if (!Ctor) {
        reject(
          new WsError(
            "No WebSocket implementation available. " +
              "In Node.js, pass the `ws` package via config.WebSocketCtor.",
          ),
        );
        return;
      }

      let ws: WebSocketLike;
      try {
        ws = new Ctor(this._config.url);
      } catch (err) {
        reject(new WsError(`WebSocket constructor failed: ${err}`));
        return;
      }

      ws.onopen = () => {
        this._ws = ws;
        this._connected = true;
        resolve();
      };

      ws.onerror = (ev) => {
        if (!this._connected) {
          reject(new WsError(`WebSocket connection error: ${ev}`));
          return;
        }
        this._handleError(ev);
      };

      ws.onclose = (ev) => {
        if (!this._connected) {
          reject(
            new WsError(
              `WebSocket closed before open: code=${ev.code} reason=${ev.reason}`,
            ),
          );
          return;
        }
        this._handleClose();
      };

      ws.onmessage = (ev) => {
        this._handleMessage(ev.data);
      };
    });
  }

  // -----------------------------------------------------------------------
  // Internal: message routing
  // -----------------------------------------------------------------------

  private _handleMessage(raw: unknown): void {
    const text = typeof raw === "string" ? raw : String(raw);
    let msg;
    try {
      msg = decodeServerMessage(text);
    } catch {
      return;
    }

    switch (msg.kind) {
      case "auth": {
        if (this._pendingAuth) {
          const pa = this._pendingAuth;
          this._pendingAuth = null;
          if (msg.status === "ok") {
            pa.resolve({
              tier: msg.tier ?? "free",
              receiptId: msg.receiptId,
            });
          } else {
            pa.reject(
              new WsError(`Auth failed: ${msg.message ?? msg.status}`),
            );
          }
        }
        break;
      }

      case "subscriptionResponse": {
        if (msg.method === "subscribe" && msg.subscription) {
          const key = routingKeyFromWire(msg.subscription);
          const pending = this._pendingSubscribes.get(key);
          if (pending) {
            this._pendingSubscribes.delete(key);
            pending.resolve();
          }
        } else if (msg.method === "unsubscribe" && msg.subscription) {
          const key = routingKeyFromWire(msg.subscription);
          const pending = this._pendingUnsubscribes.get(key);
          if (pending) {
            this._pendingUnsubscribes.delete(key);
            pending.resolve();
          }
        }
        break;
      }

      case "error": {
        if (this._pendingAuth) {
          const pa = this._pendingAuth;
          this._pendingAuth = null;
          pa.reject(new WsError(msg.message));
          return;
        }
        // Resolve any pending subscribe with error
        for (const [key, pending] of this._pendingSubscribes) {
          this._pendingSubscribes.delete(key);
          pending.reject(new WsError(msg.message));
          break;
        }
        break;
      }

      case "data": {
        const sub = this._findSubscription(msg.channel);
        if (sub) {
          const key = sub.channelSpec.routingKey;
          const isSnapshot = !this._snapshotSent.has(key);
          if (isSnapshot) this._snapshotSent.add(key);
          const event: StreamEvent = {
            channel: sub.channelSpec.type,
            data: msg.data,
            isSnapshot,
          };
          sub.push(event);
        }
        break;
      }
    }
  }

  /**
   * Find the subscription matching a server-sent channel name.
   *
   * The server uses the channel_type as the frame's `channel` field (e.g.
   * "priceFeed", "allMids", "outcomeFeed"). We first try an exact routing
   * key match, then fall back to prefix matching for specs that include
   * a coin or other qualifier.
   */
  private _findSubscription(channel: string): Subscription | undefined {
    // Exact match on channel name alone (covers bare specs like allMids)
    const exact = this._subscriptions.get(channel);
    if (exact) return exact;

    // Prefix match (covers specs like "priceFeed:BTC" routing key receiving
    // "priceFeed" channel events, or "outcomeFeed:BTC" receiving "outcomeFeed")
    for (const [key, sub] of this._subscriptions) {
      if (key.startsWith(channel + ":") || key === channel) {
        return sub;
      }
    }
    return undefined;
  }

  // -----------------------------------------------------------------------
  // Internal: error & close handling
  // -----------------------------------------------------------------------

  private _handleError(_ev: unknown): void {
    // WebSocket errors are followed by a close event; let _handleClose tear down.
  }

  private _handleClose(): void {
    this._connected = false;
    this._teardown();
  }

  private _teardown(): void {
    const error = new WsError("Connection closed");

    if (this._pendingAuth) {
      this._pendingAuth.reject(error);
      this._pendingAuth = null;
    }

    for (const [key, pending] of this._pendingSubscribes) {
      pending.reject(error);
    }
    this._pendingSubscribes.clear();

    for (const [key, pending] of this._pendingUnsubscribes) {
      pending.reject(error);
    }
    this._pendingUnsubscribes.clear();

    for (const [, sub] of this._subscriptions) {
      sub.close();
    }
    this._subscriptions.clear();
    this._snapshotSent.clear();

    this._ws = null;
  }

  private _requireOpen(): void {
    if (!this._connected || !this._ws) {
      throw new WsError("Client is not connected");
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function routingKeyFromWire(sub: {
  type: string;
  coin?: string;
  tx_types?: string[];
}): string {
  let key = sub.type;
  if (sub.coin) key += `:${sub.coin}`;
  if (sub.tx_types && sub.tx_types.length > 0) {
    key += `:${sub.tx_types.join(",")}`;
  }
  return key;
}
