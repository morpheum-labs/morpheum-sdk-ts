const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Decodes a base58-encoded string into a Buffer.
 * Handles leading '1's (zero bytes) correctly.
 */
export function base58Decode(encoded: string): Buffer {
  if (encoded.length === 0) return Buffer.alloc(0);

  let leadingZeros = 0;
  for (const char of encoded) {
    if (char === "1") leadingZeros++;
    else break;
  }

  let num = BigInt(0);
  for (const char of encoded) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error(`Invalid base58 character: '${char}'`);
    }
    num = num * 58n + BigInt(idx);
  }

  const hex = num.toString(16);
  const paddedHex = hex.length % 2 === 0 ? hex : "0" + hex;
  const decoded = Buffer.from(paddedHex, "hex");

  const result = Buffer.alloc(leadingZeros + decoded.length);
  decoded.copy(result, leadingZeros);
  return result;
}

/**
 * Converts a base58-encoded Solana address to a hex string (64 chars for 32 bytes).
 */
export function base58ToHex(address: string): string {
  const bytes = base58Decode(address);
  if (bytes.length !== 32) {
    throw new Error(
      `Expected 32-byte Solana public key, got ${bytes.length} bytes for address: ${address}`,
    );
  }
  return bytes.toString("hex");
}
