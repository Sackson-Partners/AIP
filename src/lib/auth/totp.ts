import { createHmac, randomBytes } from "crypto"

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/=+$/, "")
  let bits = 0
  let value = 0
  const output: number[] = []

  for (const char of clean) {
    const idx = BASE32_CHARS.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let output = ""

  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31]
  return output
}

function hotp(key: Buffer, counter: number): number {
  const buf = Buffer.alloc(8)
  let tmp = counter
  for (let i = 7; i >= 0; i--) {
    buf[i] = tmp & 0xff
    tmp = Math.floor(tmp / 256)
  }
  const hmac = createHmac("sha1", key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return code % 1_000_000
}

/** Verify a 6-digit TOTP token against a base32-encoded secret. ±1 window. */
export function verifyTOTP(token: string, secret: string): boolean {
  const key = base32Decode(secret)
  const counter = Math.floor(Date.now() / 1000 / 30)
  for (let delta = -1; delta <= 1; delta++) {
    const expected = String(hotp(key, counter + delta)).padStart(6, "0")
    if (token === expected) return true
  }
  return false
}

/** Generate a new base32-encoded TOTP secret (20 random bytes). */
export function generateTOTPSecret(): string {
  return base32Encode(randomBytes(20))
}

/** Return an otpauth:// URL for QR code generation. */
export function getTOTPQRUrl(email: string, secret: string): string {
  const issuer = encodeURIComponent("AIP Platform")
  const account = encodeURIComponent(email)
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}
