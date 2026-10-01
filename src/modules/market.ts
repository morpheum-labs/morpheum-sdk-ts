/**
 * Market module — typed transaction builders for CreateMarket, ActivateMarket, and SuspendMarket.
 *
 * A creation's market terms are checked when its message is encoded, so a
 * creation whose terms are outside the form the chain accepts is never built
 * or signed: see {@link encodeMsgCreateMarket}.
 */
import { create, toBinary } from "@bufbuild/protobuf";
import { MarketType } from "@morpheum/proto/market/v1/market_pb";
import {
  MsgActivateMarketRequestSchema,
  MsgCreateMarketRequestSchema,
  MsgSuspendMarketRequestSchema,
} from "@morpheum/proto/market/v1/tx_pb";
import {
  buildSignDoc,
  type ChainIdentity,
  type SignDocResult,
} from "../sign-doc";

/** The `orderbookType` of a market that trades on the CLOB. */
export const CLOB_ORDERBOOK = "clob";

/**
 * A market's trading terms.
 *
 * `tickSize`, `lotSize` and `maxLeverage` are whole numbers in the market's
 * integer price and quantity units, written in decimal digits only: no sign,
 * decimal point, exponent or whitespace (`"1"`, `"100"`; not `"0.01"`, `"+5"`
 * or `"1e3"`). They are the market's CLOB terms: required (tick and lot) on a
 * market that trades on the CLOB, and omitted on one that does not.
 */
export interface MarketParamsInput {
  /** Minimum order size. Required and non-empty. */
  minOrderSize: string;
  /** Minimum price increment: an integer in `1..=2^128-1`. */
  tickSize?: string;
  /** Minimum quantity increment: an integer in `1..=2^64-1`. */
  lotSize?: string;
  /**
   * Maximum leverage multiplier: an integer in `0..=2^32-1`. Omitted or
   * `"0"`, positions on the market are limited to 1x.
   */
  maxLeverage?: string;
  initialMarginRatio?: string;
  maintenanceMarginRatio?: string;
  allowMarketOrders?: boolean;
  allowStopOrders?: boolean;
}

export interface MarketCreateParams {
  fromAddress: string;
  baseAssetIndex: number;
  quoteAssetIndex: number;
  /** A `MarketType`: `SPOT`, `PERP`, `FUTURE`, `OPTION` or `PREDICTION`. */
  marketType: number;
  /**
   * Where the market trades. Spot, perp, future and option markets trade on
   * the CLOB and must name {@link CLOB_ORDERBOOK} exactly. A prediction
   * market trades on the CLOB only when it names it; on any other orderbook
   * type it carries no CLOB terms.
   */
  orderbookType: string;
  params: MarketParamsInput;
}

export interface MarketActivateParams {
  activator: string;
  marketIndex: number;
}

export interface MarketSuspendParams {
  suspender: string;
  marketIndex: number;
  reason: string;
}

const CREATE_MARKET_TYPE_URL = "/market.v1.MsgCreateMarketRequest";
const ACTIVATE_MARKET_TYPE_URL = "/market.v1.MsgActivateMarketRequest";
const SUSPEND_MARKET_TYPE_URL = "/market.v1.MsgSuspendMarketRequest";

const U32_MAX = (1n << 32n) - 1n;
const U64_MAX = (1n << 64n) - 1n;
const U128_MAX = (1n << 128n) - 1n;

/** A whole number written in decimal digits only. */
const WHOLE_NUMBER = /^[0-9]+$/;

/**
 * Returns `raw` unchanged if it is a whole number in `min..=max`; throws
 * otherwise, naming `field`.
 */
function integerTerm(
  field: string,
  raw: string | undefined,
  min: bigint,
  max: bigint,
): string {
  if (!raw) {
    throw new Error(`${field} is required for a market that trades on the CLOB`);
  }
  if (!WHOLE_NUMBER.test(raw)) {
    throw new Error(
      `${field} '${raw}' is not a whole number (decimal digits only: no sign, decimal point, exponent or whitespace)`,
    );
  }
  const value = BigInt(raw);
  if (value < min || value > max) {
    throw new Error(`${field} ${raw} is outside ${min}..=${max}`);
  }
  return raw;
}

/**
 * Whether a market of `marketType` on `orderbookType` trades on the CLOB.
 * Spot, perp, future and option markets must; a prediction market does when
 * it names {@link CLOB_ORDERBOOK}.
 *
 * @throws Error when `marketType` is not spot, perp, future, option or
 *   prediction, or when a spot, perp, future or option market does not name
 *   {@link CLOB_ORDERBOOK}.
 */
function tradesOnClob(marketType: number, orderbookType: string): boolean {
  const onClob = orderbookType === CLOB_ORDERBOOK;
  switch (marketType) {
    case MarketType.PREDICTION:
      return onClob;
    case MarketType.SPOT:
    case MarketType.PERP:
    case MarketType.FUTURE:
    case MarketType.OPTION:
      if (!onClob) {
        throw new Error(
          `a ${MarketType[marketType]} market trades on the CLOB: orderbookType must be '${CLOB_ORDERBOOK}', got '${orderbookType}'`,
        );
      }
      return true;
    default:
      throw new Error(
        `marketType ${marketType} is not SPOT, PERP, FUTURE, OPTION or PREDICTION`,
      );
  }
}

/**
 * The market's CLOB terms as carried in `MarketParams`: checked integers on a
 * market that trades on the CLOB, and none on a market that does not.
 */
function clobTerms(params: MarketCreateParams): {
  tickSize: string;
  lotSize: string;
  maxLeverage: string;
} {
  const { tickSize, lotSize, maxLeverage } = params.params;
  if (!tradesOnClob(params.marketType, params.orderbookType)) {
    if (tickSize || lotSize || maxLeverage) {
      throw new Error(
        `a market on orderbookType '${params.orderbookType}' does not trade on the CLOB, so it carries no tickSize, lotSize or maxLeverage`,
      );
    }
    return { tickSize: "", lotSize: "", maxLeverage: "" };
  }
  return {
    tickSize: integerTerm("tickSize", tickSize, 1n, U128_MAX),
    lotSize: integerTerm("lotSize", lotSize, 1n, U64_MAX),
    maxLeverage: maxLeverage
      ? integerTerm("maxLeverage", maxLeverage, 0n, U32_MAX)
      : "",
  };
}

/**
 * Encodes a `MsgCreateMarketRequest`.
 *
 * @throws Error, before anything is encoded, when the creation's terms are
 *   outside the canonical form the chain accepts: an empty `minOrderSize`; a
 *   market type other than spot, perp, future, option or prediction; a spot,
 *   perp, future or option market whose `orderbookType` is not
 *   {@link CLOB_ORDERBOOK}; a market on the CLOB whose `tickSize` or
 *   `lotSize` is missing, not a whole number or out of range, or whose
 *   `maxLeverage` is not a whole number or out of range; or a market off the
 *   CLOB that carries any of the three. {@link buildMarketCreateSignDoc}
 *   encodes through here, so no creation SignDoc is built for such terms.
 */
export function encodeMsgCreateMarket(params: MarketCreateParams): Uint8Array {
  if (!params.params.minOrderSize) {
    throw new Error("minOrderSize is required");
  }
  const msg = create(MsgCreateMarketRequestSchema, {
    fromAddress: params.fromAddress,
    baseAssetIndex: BigInt(params.baseAssetIndex),
    quoteAssetIndex: BigInt(params.quoteAssetIndex),
    marketType: params.marketType,
    orderbookType: params.orderbookType,
    params: {
      minOrderSize: params.params.minOrderSize,
      ...clobTerms(params),
      initialMarginRatio: params.params.initialMarginRatio ?? "",
      maintenanceMarginRatio: params.params.maintenanceMarginRatio ?? "",
      allowMarketOrders: params.params.allowMarketOrders ?? false,
      allowStopOrders: params.params.allowStopOrders ?? false,
    },
  });
  return toBinary(MsgCreateMarketRequestSchema, msg);
}

export function encodeMsgActivateMarket(
  params: MarketActivateParams,
): Uint8Array {
  const msg = create(MsgActivateMarketRequestSchema, {
    marketIndex: BigInt(params.marketIndex),
    activator: params.activator,
  });
  return toBinary(MsgActivateMarketRequestSchema, msg);
}

export function encodeMsgSuspendMarket(
  params: MarketSuspendParams,
): Uint8Array {
  const msg = create(MsgSuspendMarketRequestSchema, {
    marketIndex: BigInt(params.marketIndex),
    reason: params.reason,
    suspender: params.suspender,
  });
  return toBinary(MsgSuspendMarketRequestSchema, msg);
}


/**
 * Builds the SignDoc for a market creation.
 *
 * @throws Error, before anything is signed, on the terms
 *   {@link encodeMsgCreateMarket} refuses.
 */
export function buildMarketCreateSignDoc(
  params: MarketCreateParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
): SignDocResult {
  return buildSignDoc(
    CREATE_MARKET_TYPE_URL,
    encodeMsgCreateMarket(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
  );
}

export function buildMarketActivateSignDoc(
  params: MarketActivateParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
): SignDocResult {
  return buildSignDoc(
    ACTIVATE_MARKET_TYPE_URL,
    encodeMsgActivateMarket(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
  );
}

export function buildMarketSuspendSignDoc(
  params: MarketSuspendParams,
  signerAddress: string,
  chainType: number,
  signMode: number,
  chain: ChainIdentity,
  memo: string = "",
): SignDocResult {
  return buildSignDoc(
    SUSPEND_MARKET_TYPE_URL,
    encodeMsgSuspendMarket(params),
    signerAddress,
    chainType,
    signMode,
    chain,
    memo,
  );
}
