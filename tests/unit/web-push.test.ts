import { describe, expect, it, vi } from "vitest";
import {
  classifyPushResponse,
  createVapidAuthorization,
  isAllowedPushEndpoint,
  validatePushInputs,
} from "../../src/worker/web-push";
import * as transport from "../../src/worker/web-push";

// T008 supplies these APIs. The explicit shape keeps the test type-safe until then.
const future = transport as unknown as {
  encryptPushPayload: (input: {
    payload: string;
    p256dh: string;
    auth: string;
    salt: string;
    senderPublicKey: string;
    senderPrivateKey: string;
  }) => Promise<Uint8Array>;
  sendWebPush: (input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    payload: string;
    vapidPublicKey: string;
    vapidPrivateKey: string;
    subject: string;
    fetch: typeof fetch;
  }) => Promise<{ outcome: string }>;
};

it("matches the RFC 8291 section 5 encryption vector", async () => {
  const result = await future.encryptPushPayload({
    payload: "When I grow up, I want to be a watermelon",
    p256dh:
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    auth: "BTBZMqHH6r4Tts7J_aSIgg",
    salt: "DGv6ra1nlYgDCS1FRnbzlw",
    senderPublicKey:
      "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
    senderPrivateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  });
  expect(Buffer.from(result).toString("base64url")).toBe(
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
  );
});

it("disables redirects and classifies redirected responses", async () => {
  const receiver = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const vapid = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const receiverPublic = Buffer.from(
    await crypto.subtle.exportKey("raw", receiver.publicKey),
  ).toString("base64url");
  const vapidPublic = Buffer.from(
    await crypto.subtle.exportKey("raw", vapid.publicKey),
  ).toString("base64url");
  const vapidPrivate = (await crypto.subtle.exportKey("jwk", vapid.privateKey))
    .d!;
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://evil.example" },
      }),
    );
  const result = await future.sendWebPush({
    endpoint: "https://fcm.googleapis.com/send/id",
    p256dh: receiverPublic,
    auth: Buffer.alloc(16).toString("base64url"),
    payload: "hola",
    vapidPublicKey: vapidPublic,
    vapidPrivateKey: vapidPrivate,
    subject: "mailto:test@example.com",
    fetch: fetchMock,
  });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][1]?.redirect).toBe("error");
  expect(result.outcome).toBe("permanent_failure");
});

describe("push endpoint validation", () => {
  it("accepts recognized HTTPS providers and rejects unsafe URLs", () => {
    expect(
      isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/example"),
    ).toBe(true);
    expect(
      isAllowedPushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/example",
      ),
    ).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/example")).toBe(
      true,
    );
    expect(
      isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/push"),
    ).toBe(false);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/push")).toBe(false);
    expect(isAllowedPushEndpoint("https://user@fcm.googleapis.com/push")).toBe(
      false,
    );
    expect(
      isAllowedPushEndpoint("https://fcm.googleapis.com/push#fragment"),
    ).toBe(false);
  });
});

it("signs VAPID claims for the push provider origin", async () => {
  const keys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", keys.privateKey);
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", keys.publicKey),
  );
  const encoded = Buffer.from(publicKey).toString("base64url");
  const value = await createVapidAuthorization(
    "https://fcm.googleapis.com/send/id",
    encoded,
    jwk.d!,
    "mailto:test@example.com",
    1700000000,
  );
  const token = value.match(/^vapid t=([^,]+), k=/)?.[1];
  expect(token).toBeDefined();
  const [header, claims, signature] = token!.split(".");
  expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
    aud: "https://fcm.googleapis.com",
    exp: 1700043200,
    sub: "mailto:test@example.com",
  });
  expect(
    await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keys.publicKey,
      Buffer.from(signature, "base64url"),
      new TextEncoder().encode(`${header}.${claims}`),
    ),
  ).toBe(true);
});

it("rejects invalid subscription keys and oversized UTF-8 payloads", () => {
  const key = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString(
    "base64url",
  );
  const auth = Buffer.alloc(16, 2).toString("base64url");
  expect(() => validatePushInputs(key, auth, "hola")).not.toThrow();
  expect(() => validatePushInputs("bad", auth, "hola")).toThrow();
  expect(() => validatePushInputs(key, "bad", "hola")).toThrow();
  expect(() => validatePushInputs(key, auth, "a".repeat(3992))).not.toThrow();
  expect(() => validatePushInputs(key, auth, "a".repeat(3993))).toThrow();
  expect(() => validatePushInputs(key, auth, "é".repeat(1997))).toThrow();
});

it("classifies push responses without exposing provider details", () => {
  expect(classifyPushResponse(201)).toBe("accepted");
  expect(classifyPushResponse(404)).toBe("invalid_registration");
  expect(classifyPushResponse(410)).toBe("invalid_registration");
  expect(classifyPushResponse(429)).toBe("rate_limited");
  expect(classifyPushResponse(503)).toBe("temporary_failure");
  expect(classifyPushResponse(400)).toBe("permanent_failure");
});
