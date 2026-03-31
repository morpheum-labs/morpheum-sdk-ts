/**
 * Parses a MetaMask hex signature into raw bytes.
 * Strips the `0x` prefix and returns all 65 bytes (r:32 + s:32 + v:1).
 */
export function parseEvmSignature(sigHex: string): Uint8Array {
  const hex = sigHex.startsWith("0x") ? sigHex.slice(2) : sigHex;
  return new Uint8Array(Buffer.from(hex, "hex"));
}

/**
 * Parses a Phantom signMessage response into raw 64-byte Ed25519 signature.
 */
export function parseSolanaSignature(sigHex: string): Uint8Array {
  const hex = sigHex.startsWith("0x") ? sigHex.slice(2) : sigHex;
  return new Uint8Array(Buffer.from(hex, "hex"));
}

/**
 * Validates that a string looks like a valid EVM address (0x + 40 hex chars).
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Validates that a string looks like a valid Solana base58 address (32-44 chars).
 */
export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Validates a hex-encoded EVM signature (65 bytes = 130 hex chars).
 */
export function isValidEvmSignature(sigHex: string): boolean {
  const hex = sigHex.startsWith("0x") ? sigHex.slice(2) : sigHex;
  return /^[0-9a-fA-F]{128,130}$/.test(hex);
}

/**
 * Validates a hex-encoded Ed25519 signature (64 bytes = 128 hex chars).
 */
export function isValidEd25519Signature(sigHex: string): boolean {
  const hex = sigHex.startsWith("0x") ? sigHex.slice(2) : sigHex;
  return /^[0-9a-fA-F]{128}$/.test(hex);
}
