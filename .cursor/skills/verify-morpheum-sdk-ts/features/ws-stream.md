# Subscribe over WebSocket

`MorpheumWsClient` is a subscribe-only multiplex client. `connect` opens one socket, optional `autoAuth` authenticates, and `subscribe` waits until the server confirms the channel.

## Sub-features

- `connect-free` connects with `AuthCredentials.free()`.
- `subscribe-all-mids` subscribes to `ChannelSpec.allMids()` and checks the routing key.
- `close-client` closes the socket and the subscription.

## How to get to it (user POV)

- Import `MorpheumWsClient`, `AuthCredentials`, and `ChannelSpec` from `@morpheum/sdk`.
- Connect to the stream URL you were given. For a free tier, pass `AuthCredentials.free()` as `autoAuth`.
- Subscribe with `ChannelSpec.allMids()` or another factory. Read events from the `Subscription`.
- Call `close()` on the client when you are done.

## Driving it with verify.sh

Preconditions:

- `verify.sh doctor` printed `doctor ok`.
- `MORPHEUM_WS_URL` is a real Morpheum multiplex WebSocket URL.
- The process has a global `WebSocket`. Node 22 provides one. When it is missing, the drive fails. Do not inject `WebSocketCtor` to paper over that.
- When `MORPHEUM_WS_URL` is unset, the drive exits 2 and writes `"result": "UNMET"`.

Run this command once.

```bash
bash .cursor/skills/verify-morpheum-sdk-ts/scripts/verify.sh drive ws-stream
```

Export `MORPHEUM_WS_URL` to the stream URL before that command.

- **Connect.** The command calls `MorpheumWsClient.connect` with `autoAuth: AuthCredentials.free()`. It resolves within 15 seconds and `connected` is true.
- **Subscribe.** The command calls `subscribe(ChannelSpec.allMids())`. The server must send a `subscriptionResponse` whose `method` is `subscribe` and whose `subscription.type` is `allMids`. `observations.routingKey` is `"allMids"` and the subscription is not closed.
- **Close.** The command calls `client.close()`. `connected` is false and `observations.closedAfterClose` is true.
- **Proof.** `proof.json` has `"result": "PASS"`.

## Gotchas

- `subscribe` resolves only after the confirming frame. A socket that opens and then stays silent fails the 15 second timeout. That failure stands.
- The confirming frame for this drive is `{"channel":"subscriptionResponse","data":{"method":"subscribe","subscription":{"type":"allMids"}}}`. A different `type` does not complete this subscription.
- Auth must return status `ok`. `AuthCredentials.free()` sends tier `free` and no signature. A server that rejects the free tier fails this drive.
- The first data frame on a channel is a snapshot. This drive does not require a data frame. Do not block the proof on one.
- This library does not keep a shared socket. If the server allows one connection, do not run two `ws-stream` drives against it.
- Do not pass a hand-written `WebSocketCtor`. The drive uses the global constructor so the bytes go to `MORPHEUM_WS_URL`.
