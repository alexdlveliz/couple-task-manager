import { describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { once } from "node:events";

function fixture(fail = "") {
  const dir = mkdtempSync(join(tmpdir(), "test-workflow-"));
  for (const file of ["firebase.json", "wrangler.jsonc"])
    copyFileSync(resolve(file), join(dir, file));
  copyFileSync(resolve(".env.example"), join(dir, ".env.local"));
  copyFileSync(resolve(".dev.vars.example"), join(dir, ".dev.vars.local"));
  mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });
  for (const file of ["firebase", "wrangler"])
    writeFileSync(join(dir, "node_modules/.bin", file), "");
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "pnpm"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const net = require('node:net');
const args = process.argv.slice(2);
if (args[0] === '--version') process.exit(0);
const name = args.includes('firebase') ? 'auth' : args.includes('preview:worker') ? 'preview' : args.includes('migrations') ? 'migrations' : args[1];
fs.appendFileSync(process.env.CALLS, name + '\\n');
if (name === process.env.FAIL_STEP) process.exit(1);
if (name === 'test:unit' && process.env.WAIT_UNIT === '1') {
  const grandchild = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {detached:true, stdio:'ignore'});
  fs.appendFileSync(process.env.PIDS, grandchild.pid + '\\n');
  setInterval(() => {}, 1000);
}
if (name === 'auth' || name === 'preview') {
  fs.appendFileSync(process.env.PIDS, process.pid + '\\n');
  for (const port of name === 'auth' ? [9099, 4000] : [8787]) net.createServer().listen(port, '127.0.0.1');
} else if (name === 'test:browser' && process.env.WAIT_BROWSER === '1') setInterval(() => {}, 1000);
`,
    { mode: 0o755 },
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith("VITE_") &&
        key !== "FIREBASE_PROJECT_ID" &&
        key !== "FIREBASE_AUTH_EMULATOR_HOST",
    ),
  );
  return {
    dir,
    env: {
      ...env,
      PATH: `${bin}${delimiter}${String(process.env.PATH)}`,
      CALLS: join(dir, "calls"),
      PIDS: join(dir, "pids"),
      FAIL_STEP: fail,
    },
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const script = resolve("scripts/test-workflow.mjs");
describe("test workflow", () => {
  it.each([
    "typecheck",
    "test:unit",
    "test:integration",
    "build",
    "test:browser",
  ])(
    "reports a failing %s step and stops",
    (step) => {
      const f = fixture(step);
      try {
        const result = spawnSync(process.execPath, [script], {
          cwd: f.dir,
          env: f.env,
          encoding: "utf8",
          timeout: 20000,
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(step);
        const calls = readFileSync(f.env.CALLS, "utf8").trim().split("\n");
        expect(calls.at(-1)).toBe(step);
        if (existsSync(f.env.PIDS))
          for (const pid of readFileSync(f.env.PIDS, "utf8")
            .trim()
            .split("\n")
            .map(Number))
            expect(() => process.kill(pid, 0)).toThrow();
      } finally {
        f.cleanup();
      }
    },
    25000,
  );

  it.each([
    ["auth", "Auth emulator"],
    ["migrations", "local migrations"],
    ["preview", "Worker preview"],
  ])(
    "cleans up after %s startup failure",
    (step, message) => {
      const f = fixture(step);
      try {
        const result = spawnSync(process.execPath, [script], {
          cwd: f.dir,
          env: f.env,
          encoding: "utf8",
          timeout: 20000,
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(message);
        if (existsSync(f.env.PIDS))
          for (const pid of readFileSync(f.env.PIDS, "utf8")
            .trim()
            .split("\n")
            .map(Number))
            expect(() => process.kill(pid, 0)).toThrow();
      } finally {
        f.cleanup();
      }
    },
    25000,
  );

  it("runs all checks in order and cleans up services", () => {
    const f = fixture();
    try {
      const result = spawnSync(process.execPath, [script], {
        cwd: f.dir,
        env: f.env,
        encoding: "utf8",
        timeout: 20000,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(f.env.CALLS, "utf8").trim().split("\n")).toEqual([
        "typecheck",
        "test:unit",
        "test:integration",
        "build",
        "auth",
        "migrations",
        "seed:local",
        "preview",
        "test:browser",
      ]);
      for (const pid of readFileSync(f.env.PIDS, "utf8")
        .trim()
        .split("\n")
        .map(Number))
        expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      f.cleanup();
    }
  }, 25000);

  it("cleans up services when interrupted during browser tests", async () => {
    const f = fixture();
    const child = spawn(process.execPath, [script], {
      cwd: f.dir,
      env: { ...f.env, WAIT_BROWSER: "1" },
      stdio: "ignore",
    });
    const exited = once(child, "exit");
    try {
      const deadline = Date.now() + 15000;
      while (
        (!existsSync(f.env.CALLS) ||
          !readFileSync(f.env.CALLS, "utf8").includes("test:browser")) &&
        child.exitCode === null &&
        Date.now() < deadline
      )
        await new Promise((r) => setTimeout(r, 50));
      expect(readFileSync(f.env.CALLS, "utf8")).toContain("test:browser");
      child.kill("SIGTERM");
      const code: unknown = (await exited)[0];
      expect(code).not.toBe(0);
      for (const pid of readFileSync(f.env.PIDS, "utf8")
        .trim()
        .split("\n")
        .map(Number))
        expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      await exited;
      f.cleanup();
    }
  }, 25000);

  it("cleans up detached descendants when interrupted during unit tests", async () => {
    const f = fixture();
    const child = spawn(process.execPath, [script], {
      cwd: f.dir,
      env: { ...f.env, WAIT_UNIT: "1" },
      stdio: "ignore",
    });
    const exited = once(child, "exit");
    try {
      const deadline = Date.now() + 15000;
      while (
        !existsSync(f.env.PIDS) &&
        child.exitCode === null &&
        Date.now() < deadline
      )
        await new Promise((r) => setTimeout(r, 50));
      expect(existsSync(f.env.PIDS)).toBe(true);
      const pid = Number(readFileSync(f.env.PIDS, "utf8").trim());
      child.kill("SIGTERM");
      await exited;
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      if (existsSync(f.env.PIDS)) {
        try {
          process.kill(
            Number(readFileSync(f.env.PIDS, "utf8").trim()),
            "SIGKILL",
          );
        } catch {
          /* The process may have already exited. */
        }
      }
      if (child.exitCode === null) child.kill("SIGTERM");
      await exited;
      f.cleanup();
    }
  }, 25000);

  it("times out when a service never becomes ready", () => {
    const source = `import { Supervisor } from ${JSON.stringify(new URL("../../scripts/workflow-common.mjs", import.meta.url).href)}; const s = new Supervisor(); const child = { pid: process.pid, exitCode: null, signalCode: null }; try { await s.ready('test service', child, 0, 100); process.exitCode = 1; } catch (e) { console.error(e.message); }`;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", source],
      { encoding: "utf8", timeout: 5000 },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("did not become ready");
  });
});
