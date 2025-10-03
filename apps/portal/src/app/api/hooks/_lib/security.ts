import { createHmac, timingSafeEqual } from "node:crypto";

export interface SignatureVerificationInput {
  secret: string;
  signatureHeader: string;
  nonce: string;
  payload: string;
  toleranceSeconds?: number;
}

export interface VerifiedSignature {
  timestamp: number;
  signature: string;
  version: string;
}

const DEFAULT_TOLERANCE = 5 * 60; // five minutes

export class SignatureVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureVerificationError";
  }
}

export class NonceReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonceReplayError";
  }
}

function getReplayCache(): Map<string, number> {
  const globalScope = globalThis as typeof globalThis & {
    __fcReplayCache?: Map<string, number>;
  };

  if (!globalScope.__fcReplayCache) {
    globalScope.__fcReplayCache = new Map();
  }

  return globalScope.__fcReplayCache;
}

export function assertUniqueNonce(key: string, nonce: string, ttlSeconds = DEFAULT_TOLERANCE) {
  if (!nonce) {
    throw new NonceReplayError("Missing nonce");
  }

  const cache = getReplayCache();
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;

  for (const [entryKey, expiry] of cache.entries()) {
    if (expiry <= now) {
      cache.delete(entryKey);
    }
  }

  const compositeKey = `${key}:${nonce}`;
  if (cache.has(compositeKey)) {
    throw new NonceReplayError("Nonce has already been used");
  }

  cache.set(compositeKey, expiresAt);
}

function parseSignatureHeader(header: string): VerifiedSignature {
  const parts = header.split(",");
  const values = Object.fromEntries(
    parts
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, value] = part.split("=");
        return [key, value];
      })
  );

  const timestamp = Number(values.t);
  if (!Number.isFinite(timestamp)) {
    throw new SignatureVerificationError("Missing timestamp in signature header");
  }

  const signature = values.v1 ?? values.sig;
  if (!signature) {
    throw new SignatureVerificationError("Missing signature digest");
  }

  const version = values.v ?? "v1";

  return { timestamp, signature, version };
}

export function verifySignature(input: SignatureVerificationInput): VerifiedSignature {
  const { secret, signatureHeader, nonce, payload, toleranceSeconds = DEFAULT_TOLERANCE } = input;

  if (!signatureHeader) {
    throw new SignatureVerificationError("Missing signature header");
  }

  const parsed = parseSignatureHeader(signatureHeader);
  const ageSeconds = Math.abs(Date.now() / 1000 - parsed.timestamp);
  if (ageSeconds > toleranceSeconds) {
    throw new SignatureVerificationError("Signature timestamp outside tolerance");
  }

  const canonical = `${parsed.timestamp}.${nonce}.${payload}`;
  const expected = createHmac("sha256", secret).update(canonical).digest("hex");
  const provided = parsed.signature;

  try {
    const matches = timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
    if (!matches) {
      throw new SignatureVerificationError("Signature verification failed");
    }
  } catch (error) {
    throw new SignatureVerificationError("Signature verification failed");
  }

  return parsed;
}
