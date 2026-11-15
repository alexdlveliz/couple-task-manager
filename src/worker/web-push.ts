import type { DeliveryOutcome } from "../shared/notifications";

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createVapidAuthorization(
  endpoint: string,
  publicKey: string,
  privateKey: string,
  subject: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  if (!isAllowedPushEndpoint(endpoint))
    throw new Error("Invalid push endpoint");
  const publicBytes = decodeKey(publicKey);
  const privateBytes = decodeKey(privateKey);
  if (
    publicBytes.length !== 65 ||
    publicBytes[0] !== 4 ||
    privateBytes.length !== 32 ||
    !/^(mailto:|https:\/\/)/.test(subject)
  )
    throw new Error("Invalid VAPID configuration");
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: encodeBase64Url(publicBytes.slice(1, 33)),
      y: encodeBase64Url(publicBytes.slice(33)),
      d: privateKey,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const encodeJson = (value: unknown) =>
    encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
  const input = `${encodeJson({ typ: "JWT", alg: "ES256" })}.${encodeJson({ aud: new URL(endpoint).origin, exp: nowSeconds + 43200, sub: subject })}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(input),
  );
  return `vapid t=${input}.${encodeBase64Url(new Uint8Array(signature))}, k=${publicKey}`;
}

function decodeKey(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid push key");
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(decoded, (character) =>
    character.charCodeAt(0),
  );
  const canonical = btoa(decoded)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  if (canonical !== value) throw new Error("Invalid push key");
  return bytes;
}

export function validatePushInputs(
  p256dh: string,
  auth: string,
  payload: string,
): void {
  const publicKey = decodeKey(p256dh);
  if (
    publicKey.length !== 65 ||
    publicKey[0] !== 4 ||
    decodeKey(auth).length !== 16
  )
    throw new Error("Invalid push key");
  if (new TextEncoder().encode(payload).length >= 3993)
    throw new Error("Push payload too large");
}

/** Only known browser push services may be contacted by the Worker. */
export function isAllowedPushEndpoint(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !url.port &&
      (url.hostname === "fcm.googleapis.com" ||
        url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname === "web.push.apple.com" ||
        url.hostname.endsWith(".push.apple.com"))
    );
  } catch {
    return false;
  }
}

export function classifyPushResponse(status: number): DeliveryOutcome {
  if (status >= 200 && status < 300) return "accepted";
  if (status === 404 || status === 410) return "invalid_registration";
  if (status === 429) return "rate_limited";
  if (status >= 500 && status < 600) return "temporary_failure";
  return "permanent_failure";
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function hkdf(
  key: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const material = await crypto.subtle.importKey(
    "raw",
    concat(key),
    "HKDF",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: concat(salt), info: concat(info) },
      material,
      length * 8,
    ),
  );
}

export interface PushEncryptionInput {
  payload: string;
  p256dh: string;
  auth: string;
  salt?: string;
  senderPublicKey?: string;
  senderPrivateKey?: string;
}

export async function encryptPushPayload(
  input: PushEncryptionInput,
): Promise<Uint8Array<ArrayBuffer>> {
  validatePushInputs(input.p256dh, input.auth, input.payload);
  const receiverBytes = decodeKey(input.p256dh);
  const receiver = await crypto.subtle.importKey(
    "raw",
    concat(receiverBytes),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  let sender: CryptoKeyPair;
  if (input.senderPublicKey && input.senderPrivateKey) {
    const publicBytes = decodeKey(input.senderPublicKey);
    if (
      publicBytes.length !== 65 ||
      publicBytes[0] !== 4 ||
      decodeKey(input.senderPrivateKey).length !== 32
    )
      throw new Error("Invalid sender key");
    const jwk = {
      kty: "EC",
      crv: "P-256",
      x: encodeBase64Url(publicBytes.slice(1, 33)),
      y: encodeBase64Url(publicBytes.slice(33)),
      d: input.senderPrivateKey,
    };
    sender = {
      privateKey: await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveBits"],
      ),
      publicKey: await crypto.subtle.importKey(
        "raw",
        concat(publicBytes),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        [],
      ),
    };
  } else {
    if (input.senderPublicKey || input.senderPrivateKey)
      throw new Error("Incomplete sender key");
    sender = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
  }
  const senderBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", sender.publicKey),
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: receiver },
      sender.privateKey,
      256,
    ),
  );
  const salt = input.salt
    ? decodeKey(input.salt)
    : crypto.getRandomValues(new Uint8Array(16));
  if (salt.length !== 16) throw new Error("Invalid salt");
  const encoder = new TextEncoder();
  const ikm = await hkdf(
    shared,
    decodeKey(input.auth),
    concat(encoder.encode("WebPush: info\0"), receiverBytes, senderBytes),
    32,
  );
  const cek = await hkdf(
    ikm,
    salt,
    encoder.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    ikm,
    salt,
    encoder.encode("Content-Encoding: nonce\0"),
    12,
  );
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, [
    "encrypt",
  ]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      concat(encoder.encode(input.payload), new Uint8Array([2])),
    ),
  );
  return concat(
    salt,
    new Uint8Array([0, 0, 16, 0, 65]),
    senderBytes,
    ciphertext,
  );
}

export async function sendWebPush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subject: string;
  fetch?: typeof fetch;
}): Promise<{ outcome: DeliveryOutcome; retryAfter: string | null }> {
  if (!isAllowedPushEndpoint(input.endpoint))
    throw new Error("Invalid push endpoint");
  const body = await encryptPushPayload(input);
  const authorization = await createVapidAuthorization(
    input.endpoint,
    input.vapidPublicKey,
    input.vapidPrivateKey,
    input.subject,
  );
  try {
    const response = await (input.fetch ?? fetch)(input.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    return {
      outcome: classifyPushResponse(response.status),
      retryAfter:
        response.status === 429 ? response.headers.get("Retry-After") : null,
    };
  } catch {
    return { outcome: "temporary_failure", retryAfter: null };
  }
}
