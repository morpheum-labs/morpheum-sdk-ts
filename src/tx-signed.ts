/**
 * Assembles a complete Tx proto object for gRPC submission via IngressService/SubmitTx.
 *
 * Uses generated proto types from @morpheum/proto directly (camelCase, typed).
 */
import { create } from "@bufbuild/protobuf";
import {
  TxSchema,
  TxBodySchema,
  AuthInfoSchema,
  NonceSchema,
  type Tx,
} from "@morpheum/proto/tx/v1/tx_pb";
import { ChainType } from "@morpheum/proto/primitives/v1/chain_pb";

function buildSignerKeyInfo(signerAddress: string, chainType: number) {
  const isEvm = chainType === ChainType.ETHEREUM;
  const hex = signerAddress.startsWith("0x")
    ? signerAddress.slice(2)
    : signerAddress;
  const bytes = Uint8Array.from(Buffer.from(hex, "hex"));
  return {
    typeUrl: isEvm
      ? "/cosmos.crypto.secp256k1.PubKey"
      : "/cosmos.crypto.ed25519.PubKey",
    value: bytes,
  };
}

export function buildSignedTx(
  typeUrl: string,
  msgBytes: Uint8Array,
  signerAddress: string,
  signature: Uint8Array,
  chainType: number,
  signMode: number,
  memo: string = "",
): Tx {
  const keyInfo = buildSignerKeyInfo(signerAddress, chainType);

  return create(TxSchema, {
    body: create(TxBodySchema, {
      messages: [{ typeUrl, value: msgBytes }],
      memo,
    }),
    authInfo: create(AuthInfoSchema, {
      signerInfos: [
        {
          publicKey: { typeUrl: keyInfo.typeUrl, value: keyInfo.value },
          modeInfo: {
            sum: { case: "single", value: { mode: signMode } },
          },
          chainType,
        },
      ],
    }),
    signatures: [signature],
    nonce: create(NonceSchema, {
      monotonic: 0n,
      tsMs: Date.now() % 0x100000000,
      sub: 0,
    }),
  });
}
