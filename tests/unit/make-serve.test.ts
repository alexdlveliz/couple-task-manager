import { afterEach, describe, expect, it } from "vitest";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:net";
import { once } from "node:events";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, delimiter } from "node:path";

let child: ChildProcess | undefined;
let server: Server | undefined;
afterEach(async () => {
  child?.kill("SIGTERM");
  if (child && child.exitCode === null && child.signalCode === null)
    await once(child, "exit");
  child = undefined;
  if (server) {
    const current = server;
    await new Promise<void>((resolve) =>
      current.close(() => {
        resolve();
      }),
    );
  }
  server = undefined;
});

describe("make serve", () => {
  it("reports an occupied required port without stopping its owner", async () => {
    const current = createServer();
    server = current;
    await new Promise<void>((resolve, reject) =>
      current.listen(9099, "127.0.0.1", resolve).on("error", reject),
    );
    const result = spawnSync("make", ["serve"], {
      encoding: "utf8",
      timeout: 15000,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/9099/);
    expect(server.listening).toBe(true);
  });

  it("reports a missing local configuration before starting services", () => {
    const dir = mkdtempSync(join(tmpdir(), "serve-test-"));
    try {
      const result = spawnSync("node", [resolve("scripts/serve.mjs")], {
        encoding: "utf8",
        timeout: 15000,
        cwd: dir,
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/configuration/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports a missing prerequisite before starting services", () => {
    const dir = mkdtempSync(join(tmpdir(), "serve-prerequisite-"));
    try {
      for (const file of ["firebase.json", "wrangler.jsonc"])
        copyFileSync(resolve(file), join(dir, file));
      copyFileSync(resolve(".env.example"), join(dir, ".env.local"));
      copyFileSync(resolve(".dev.vars.example"), join(dir, ".dev.vars.local"));
      const bin = join(dir, "bin");
      mkdirSync(bin);
      writeFileSync(join(bin, "pnpm"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) =>
            !key.startsWith("VITE_") &&
            key !== "FIREBASE_PROJECT_ID" &&
            key !== "FIREBASE_AUTH_EMULATOR_HOST",
        ),
      );
      const result = spawnSync(
        process.execPath,
        [resolve("scripts/serve.mjs")],
        {
          cwd: dir,
          encoding: "utf8",
          timeout: 15000,
          env: { ...env, PATH: bin },
        },
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/prerequisite: java/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each(["interrupt", "migration failure", "auth failure"])(
    "cleans up the emulator after %s",
    async (scenario) => {
      const dir = mkdtempSync(join(tmpdir(), "serve-lifecycle-"));
      try {
        for (const file of [
          "firebase.json",
          "wrangler.jsonc",
          ".env.example",
          ".dev.vars.example",
        ])
          copyFileSync(resolve(file), join(dir, file));
        copyFileSync(join(dir, ".env.example"), join(dir, ".env.local"));
        copyFileSync(
          join(dir, ".dev.vars.example"),
          join(dir, ".dev.vars.local"),
        );
        mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });
        writeFileSync(join(dir, "node_modules/.bin/firebase"), "");
        writeFileSync(join(dir, "node_modules/.bin/wrangler"), "");
        const bin = join(dir, "bin");
        mkdirSync(bin);
        const fake = `#!/usr/bin/env node
const fs = require('node:fs');
const net = require('node:net');
const args = process.argv.slice(2);
if (args[0] === '--version') process.exit(0);
if (args.includes('migrations')) process.exit(process.env.FAIL_MIGRATION === '1' ? 1 : 0);
if (args.includes('seed:local')) process.exit(0);
if (args.includes('firebase') && process.env.FAIL_AUTH === '1') process.exit(1);
const ports = args.includes('firebase') ? [9099, 4000] : [8787, 5173];
fs.appendFileSync(process.env.PID_FILE, process.pid + '\\n');
for (const port of ports) net.createServer().listen(port, '127.0.0.1');
`;
        writeFileSync(join(bin, "pnpm"), fake, { mode: 0o755 });
        const pidFile = join(dir, "pids");
        const cleanEnv = Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) =>
              !key.startsWith("VITE_") &&
              key !== "FIREBASE_PROJECT_ID" &&
              key !== "FIREBASE_AUTH_EMULATOR_HOST",
          ),
        );
        child = spawn("node", [resolve("scripts/serve.mjs")], {
          cwd: dir,
          env: {
            ...cleanEnv,
            PATH: `${bin}${delimiter}${String(process.env.PATH)}`,
            PID_FILE: pidFile,
            FAIL_MIGRATION: scenario === "migration failure" ? "1" : "0",
            FAIL_AUTH: scenario === "auth failure" ? "1" : "0",
          },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        child.stdout?.on("data", (data: Buffer) => {
          output += data.toString();
        });
        child.stderr?.on("data", (data: Buffer) => {
          output += data.toString();
        });
        const exited = once(child, "exit");
        if (scenario === "interrupt") {
          const deadline = Date.now() + 15000;
          while (
            !output.includes("Application ready") &&
            child.exitCode === null &&
            Date.now() < deadline
          )
            await new Promise((r) => setTimeout(r, 50));
          expect(output).toContain("Application ready");
          child.kill("SIGTERM");
        }
        await exited;
        expect(output).toContain(
          scenario === "interrupt"
            ? "Application ready"
            : scenario === "auth failure"
              ? "Auth emulator stopped"
              : "local migrations failed",
        );
        if (scenario !== "auth failure") expect(existsSync(pidFile)).toBe(true);
        for (const pid of existsSync(pidFile)
          ? readFileSync(pidFile, "utf8").trim().split("\n").map(Number)
          : []) {
          expect(() => process.kill(pid, 0)).toThrow();
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    25000,
  );
});
