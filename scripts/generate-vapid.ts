import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";

// Deliberately refuse to overwrite an existing secrets file.
const destination = process.argv[2] ?? ".dev.vars.vapid.local";
if (!/^\.dev\.vars(?:\.[a-zA-Z0-9_-]+)*\.local$/.test(destination)) {
  throw new Error("Use an ignored .dev.vars.*.local file in the project root");
}
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
if (!jwk.x || !jwk.y || !jwk.d) throw new Error("Key generation failed");
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, "base64url"),
  Buffer.from(jwk.y, "base64url"),
]).toString("base64url");
writeFileSync(destination, `VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${jwk.d}\nVAPID_SUBJECT=mailto:replace@example.com\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`Development credentials written to ${destination}\n`);
