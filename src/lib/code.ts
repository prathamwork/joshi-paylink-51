// Non-enumerable, URL-safe public code generator.
// Base32 Crockford alphabet minus ambiguous chars; 26 chars ~= 130 bits entropy.
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

export function generatePublicCode(length = 26): string {
  const bytes = new Uint8Array(length);
  // Node & Web Crypto both expose this via globalThis.crypto.
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
