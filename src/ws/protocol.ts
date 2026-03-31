/**
 * JSON wire protocol for the Morpheum multiplex WebSocket endpoint.
 *
 * Mirrors the framing defined in
 * mormcore/crates/node/src/services/ws/protocol.rs.
 *
 * Client sends `auth`, `subscribe`, `unsubscribe` messages; server responds
 * with `auth`, `subscriptionResponse`, `error`, or typed data frames.
 */

import type { AuthCredentials, ChannelSpec, StreamTier } from "./types";

// ---------------------------------------------------------------------------
// Client -> Server encoders
// ---------------------------------------------------------------------------

export function encodeAuth(credentials: AuthCredentials): string {
  const data: Record<string, unknown> = { tier: credentials.tier };
  if (credentials.signature != null) data.signature = credentials.signature;
  if (credentials.agentId != null) data.agent_id = credentials.agentId;
  return JSON.stringify({ method: "auth", data });
}

export function encodeSubscribe(spec: ChannelSpec): string {
  return JSON.stringify({ method: "subscribe", subscription: spec.toWire() });
}

export function encodeUnsubscribe(spec: ChannelSpec): string {
  return JSON.stringify({ method: "unsubscribe", subscription: spec.toWire() });
}

// ---------------------------------------------------------------------------
// Server -> Client decoders
// ---------------------------------------------------------------------------

export type ServerMessage =
  | AuthResult
  | SubscriptionConfirm
  | ErrorResult
  | DataFrame;

export interface AuthResult {
  kind: "auth";
  status: string;
  tier?: StreamTier;
  receiptId?: string;
  message?: string;
}

export interface SubscriptionConfirm {
  kind: "subscriptionResponse";
  method?: string;
  subscription?: { type: string; coin?: string };
}

export interface ErrorResult {
  kind: "error";
  message: string;
}

export interface DataFrame {
  kind: "data";
  channel: string;
  data: unknown;
}

export function decodeServerMessage(raw: string): ServerMessage {
  const parsed = JSON.parse(raw) as { channel: string; data: unknown };
  const { channel, data } = parsed;

  switch (channel) {
    case "auth": {
      const d = data as Record<string, unknown>;
      return {
        kind: "auth",
        status: String(d.status ?? ""),
        tier: d.tier as StreamTier | undefined,
        receiptId: d.receipt_id != null ? String(d.receipt_id) : undefined,
        message: d.message != null ? String(d.message) : undefined,
      };
    }
    case "subscriptionResponse": {
      const d = data as Record<string, unknown>;
      return {
        kind: "subscriptionResponse",
        method: d.method != null ? String(d.method) : undefined,
        subscription: d.subscription as
          | { type: string; coin?: string }
          | undefined,
      };
    }
    case "error": {
      const d = data as Record<string, unknown>;
      return {
        kind: "error",
        message: String(d.message ?? data),
      };
    }
    default:
      return { kind: "data", channel, data };
  }
}
