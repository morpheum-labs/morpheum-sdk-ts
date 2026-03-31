/**
 * Subscribe-only multiplex WebSocket client for the Morpheum streaming layer.
 *
 * Re-exports all public types, the client class, and the Subscription handle.
 */

export { MorpheumWsClient, WsError } from "./client";
export { Subscription } from "./subscription";
export {
  ChannelSpec,
  AuthCredentials,
  type AuthResponse,
  type StreamEvent,
  type StreamTier,
  type WsClientConfig,
  type WebSocketConstructor,
  type WebSocketLike,
} from "./types";
