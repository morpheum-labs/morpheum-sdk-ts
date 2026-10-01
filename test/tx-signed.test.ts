/**
 * Runtime pins for `buildSignedTx`: a signed transaction carries, byte for
 * byte, the body, auth info and nonce its signature covers.
 *
 * The `_SentTxIsTheSignedBytes` type pin in `src/tx-signed.ts` keeps those
 * encodings a required input, but a type cannot see whether they are used.
 * These tests fail if the transaction is rebuilt from parts instead of decoded
 * from the signed encodings: a rebuild loses every field it does not set.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { create, toBinary } from "@bufbuild/protobuf";
import { BinaryWriter, WireType } from "@bufbuild/protobuf/wire";
import {
  AuthInfoSchema,
  NonceSchema,
  TxBodySchema,
  type Tx,
} from "@morpheum/proto/tx/v1/tx_pb";
import {
  ChainType,
  DEFAULT_CHAIN_ID,
  SignMode,
  buildBucketCreateSignDoc,
  buildSignedTx,
  encodeMsgCreateBucket,
  type BucketCreateParams,
  type SignDocResult,
} from "../src/index";

const SIGNER = `0x${"11".repeat(20)}`;
const SIGNATURE = new Uint8Array(65).fill(0xab);
const CREATE_BUCKET_TYPE_URL = "/bucket.v1.MsgCreateBucketRequest";
const CREATE_BUCKET: BucketCreateParams = {
  fromAddress: SIGNER,
  bucketId: "bucket-1",
  bucketType: 1,
  collateralAssetIndex: 0,
  initialMargin: "100",
};

type SignedEncodings = Pick<
  SignDocResult,
  "bodyBytes" | "authInfoBytes" | "nonce"
>;

/**
 * Asserts that `tx` re-encodes to exactly the encodings that were signed.
 *
 * Compared as one keyed object so a failure's diff names the encoding that
 * diverged.
 */
function assertCarriesSignedEncodings(tx: Tx, signed: SignedEncodings): void {
  assert.ok(tx.body && tx.authInfo && tx.nonce);
  assert.deepEqual(
    {
      bodyBytes: toBinary(TxBodySchema, tx.body),
      authInfoBytes: toBinary(AuthInfoSchema, tx.authInfo),
      nonce: toBinary(NonceSchema, tx.nonce),
      signatures: tx.signatures,
    },
    {
      bodyBytes: signed.bodyBytes,
      authInfoBytes: signed.authInfoBytes,
      nonce: signed.nonce,
      signatures: [SIGNATURE],
    },
  );
}

describe("buildSignedTx", () => {
  it("carries fields this SDK never sets and fields its schema does not know", () => {
    // One past the highest field number TxBody declares, so it stays unknown
    // to this SDK's schema by construction: the shape of a field bound by a
    // signer built against a newer schema.
    const unknownFieldNo =
      Math.max(...TxBodySchema.fields.map((field) => field.number)) + 1;
    const body = create(TxBodySchema, {
      messages: [
        {
          typeUrl: CREATE_BUCKET_TYPE_URL,
          value: encodeMsgCreateBucket(CREATE_BUCKET),
        },
      ],
      memo: "memo",
      txClass: 2,
      urgent: true,
    });
    const authInfo = create(AuthInfoSchema, {
      signerInfos: [
        {
          publicKey: {
            typeUrl: "/cosmos.crypto.secp256k1.PubKey",
            value: new Uint8Array(20).fill(0x11),
          },
          modeInfo: {
            sum: { case: "single", value: { mode: SignMode.EIP191_PERSONAL } },
          },
          chainType: ChainType.ETHEREUM,
        },
      ],
      gasLimit: 25_000n,
    });
    const signed: SignedEncodings = {
      bodyBytes: new BinaryWriter()
        .raw(toBinary(TxBodySchema, body))
        .tag(unknownFieldNo, WireType.Varint)
        .uint32(1)
        .finish(),
      authInfoBytes: toBinary(AuthInfoSchema, authInfo),
      nonce: toBinary(
        NonceSchema,
        create(NonceSchema, { monotonic: 7n, tsMs: 1_234_567, sub: 3 }),
      ),
    };

    const tx = buildSignedTx(signed, SIGNATURE);

    assert.equal(tx.authInfo?.gasLimit, 25_000n);
    assert.equal(tx.body?.txClass, 2);
    assert.equal(tx.body?.urgent, true);
    assertCarriesSignedEncodings(tx, signed);
  });

  it("carries a module builder's SignDoc result byte for byte", () => {
    const signDoc = buildBucketCreateSignDoc(
      CREATE_BUCKET,
      SIGNER,
      ChainType.ETHEREUM,
      SignMode.EIP191_PERSONAL,
      { chainId: DEFAULT_CHAIN_ID, genesisHash: new Uint8Array(32).fill(7) },
      "memo",
    );

    const tx = buildSignedTx(signDoc, SIGNATURE);

    assert.deepEqual(
      tx.body?.messages.map(({ typeUrl, value }) => [typeUrl, value]),
      [[CREATE_BUCKET_TYPE_URL, encodeMsgCreateBucket(CREATE_BUCKET)]],
    );
    assertCarriesSignedEncodings(tx, signDoc);
  });
});
