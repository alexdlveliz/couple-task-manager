import { expect, it, vi } from "vitest";
import { sendWebPush } from "../../src/worker/web-push";

it("uses a redirect mode supported by Workers without following redirects", async () => {
  const encode = (bytes: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
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
  const mock = vi.fn<typeof fetch>(async (url, init) => {
    const request = new Request(url, init);
    expect(request.redirect).toBe("manual");
    return new Response(null, {
      status: 302,
      headers: { Location: "https://example.com/" },
    });
  });
  const result = await sendWebPush({
    endpoint: "https://fcm.googleapis.com/test",
    p256dh: encode(await crypto.subtle.exportKey("raw", receiver.publicKey)),
    auth: encode(new Uint8Array(16).buffer),
    payload: "{}",
    vapidPublicKey: encode(
      await crypto.subtle.exportKey("raw", vapid.publicKey),
    ),
    vapidPrivateKey: (await crypto.subtle.exportKey("jwk", vapid.privateKey))
      .d!,
    subject: "mailto:test@example.com",
    fetch: mock,
  });
  expect(mock).toHaveBeenCalledOnce();
  expect(result.outcome).toBe("permanent_failure");
});
