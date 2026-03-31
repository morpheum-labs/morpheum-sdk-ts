/**
 * Subscription handle returned by MorpheumWsClient.subscribe().
 *
 * Implements AsyncIterable so callers can consume events with
 * `for await (const event of subscription)` or call `next()` directly.
 *
 * Mirrors morpheum-sdk/crates/ws/src/subscription.rs.
 */

import type { ChannelSpec, StreamEvent } from "./types";

const DEFAULT_BUFFER_CAPACITY = 256;

interface Waiter {
  resolve: (value: IteratorResult<StreamEvent>) => void;
  reject: (reason: unknown) => void;
}

/**
 * An active subscription to a single streaming channel.
 *
 * Events flow from the MorpheumWsClient message handler into this handle
 * via the internal push() method. The consumer pulls events via the
 * AsyncIterator protocol or the convenience next() method.
 */
export class Subscription implements AsyncIterable<StreamEvent> {
  private readonly _spec: ChannelSpec;
  private readonly _buffer: StreamEvent[];
  private readonly _capacity: number;
  private readonly _waiters: Waiter[] = [];
  private _closed = false;
  private _error: unknown = undefined;

  /** @internal — constructed by MorpheumWsClient, not by consumers. */
  constructor(spec: ChannelSpec, capacity: number = DEFAULT_BUFFER_CAPACITY) {
    this._spec = spec;
    this._buffer = [];
    this._capacity = capacity;
  }

  get channelSpec(): ChannelSpec {
    return this._spec;
  }

  get closed(): boolean {
    return this._closed;
  }

  /**
   * Returns the next event, or null when the subscription has ended.
   * Convenience wrapper over the async iterator.
   */
  async next(): Promise<StreamEvent | null> {
    if (this._buffer.length > 0) {
      return this._buffer.shift()!;
    }
    if (this._closed) {
      if (this._error) throw this._error;
      return null;
    }
    return new Promise<StreamEvent | null>((resolve, reject) => {
      this._waiters.push({
        resolve: (result) => resolve(result.done ? null : result.value),
        reject,
      });
    });
  }

  /** @internal — called by MorpheumWsClient to deliver an event. */
  push(event: StreamEvent): void {
    if (this._closed) return;

    const waiter = this._waiters.shift();
    if (waiter) {
      waiter.resolve({ value: event, done: false });
      return;
    }

    if (this._buffer.length < this._capacity) {
      this._buffer.push(event);
    }
    // Over capacity: drop oldest to prevent unbounded growth.
    // The consumer is not keeping up; this matches the Rust SDK's
    // bounded mpsc channel behavior where sends block/fail.
  }

  /** @internal — called by MorpheumWsClient when the subscription is cancelled or the connection closes. */
  close(error?: unknown): void {
    if (this._closed) return;
    this._closed = true;
    this._error = error;

    while (this._waiters.length > 0) {
      const waiter = this._waiters.shift()!;
      if (error) {
        waiter.reject(error);
      } else {
        waiter.resolve({ value: undefined as unknown as StreamEvent, done: true });
      }
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
    return {
      next: async (): Promise<IteratorResult<StreamEvent>> => {
        if (this._buffer.length > 0) {
          return { value: this._buffer.shift()!, done: false };
        }
        if (this._closed) {
          if (this._error) throw this._error;
          return { value: undefined as unknown as StreamEvent, done: true };
        }
        return new Promise<IteratorResult<StreamEvent>>((resolve, reject) => {
          this._waiters.push({ resolve, reject });
        });
      },
    };
  }
}
