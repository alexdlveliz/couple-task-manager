import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Generate a one-day keypair for this test process; never reuse it for authentication. */
export function createEphemeralCertificate(): {
  privateKey: string;
  certificate: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "shared-board-test-cert-"));
  const keyFile = join(directory, "key.pem");
  const certificateFile = join(directory, "certificate.pem");
  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        keyFile,
        "-out",
        certificateFile,
        "-subj",
        "/CN=ephemeral-local-test",
        "-days",
        "1",
      ],
      { stdio: "ignore" },
    );
    return {
      privateKey: readFileSync(keyFile, "utf8"),
      certificate: readFileSync(certificateFile, "utf8"),
    };
  } finally {
    for (const path of [keyFile, certificateFile]) {
      try {
        unlinkSync(path);
      } catch (error) {
        // eslint-disable-next-line no-unsafe-finally -- Report cleanup failures rather than leaving test key material behind.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    rmdirSync(directory);
  }
}
