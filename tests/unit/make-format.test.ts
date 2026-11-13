import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("format workflow", () => {
  it("formats supported files idempotently while preserving protected files", () => {
    const dir = mkdtempSync(join(tmpdir(), "format-policy-"));
    try {
      const source = join(dir, "example.js");
      const protectedFile = join(dir, "AGENTS.md");
      writeFileSync(source, "export const value=1\n");
      writeFileSync(protectedFile, "#   Protected\n");
      const args = [
        "--write",
        ".",
        "--ignore-path",
        resolve(".prettierignore"),
      ];
      const first = spawnSync(resolve("node_modules/.bin/prettier"), args, {
        cwd: dir,
        encoding: "utf8",
        timeout: 10000,
      });
      expect(first.status, first.stderr).toBe(0);
      expect(readFileSync(source, "utf8")).toBe("export const value = 1;\n");
      expect(readFileSync(protectedFile, "utf8")).toBe("#   Protected\n");
      const second = spawnSync(resolve("node_modules/.bin/prettier"), args, {
        cwd: dir,
        encoding: "utf8",
        timeout: 10000,
      });
      expect(second.status, second.stderr).toBe(0);
      expect(readFileSync(source, "utf8")).toBe("export const value = 1;\n");
      expect(readFileSync(protectedFile, "utf8")).toBe("#   Protected\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("stops correction and later checks when interrupted", async () => {
    const dir = mkdtempSync(join(tmpdir(), "format-interrupt-"));
    mkdirSync(join(dir, "scripts"));
    mkdirSync(join(dir, "bin"));
    copyFileSync(
      resolve("scripts/quality.mjs"),
      join(dir, "scripts/quality.mjs"),
    );
    writeFileSync(
      join(dir, "bin/pnpm"),
      `#!${process.execPath}\nconst fs = require('node:fs');\nfs.appendFileSync(process.env.CALLS, process.argv[3] + '\\n');\nfs.writeFileSync(process.env.READY, String(process.pid));\nsetInterval(() => {}, 1000);\n`,
      { mode: 0o755 },
    );
    const calls = join(dir, "calls");
    const ready = join(dir, "ready");
    const child = spawn(process.execPath, ["scripts/quality.mjs", "--fix"], {
      cwd: dir,
      env: {
        ...process.env,
        PATH: `${join(dir, "bin")}${delimiter}${process.env.PATH ?? ""}`,
        CALLS: calls,
        READY: ready,
      },
      stdio: "ignore",
    });
    const exited = once(child, "exit");
    try {
      const deadline = Date.now() + 5000;
      while (
        !existsSync(ready) &&
        child.exitCode === null &&
        Date.now() < deadline
      )
        await new Promise((done) => setTimeout(done, 20));
      expect(existsSync(ready)).toBe(true);
      const pid = Number(readFileSync(ready, "utf8"));
      child.kill("SIGTERM");
      const code: unknown = (await exited)[0];
      expect(code).not.toBe(0);
      expect(readFileSync(calls, "utf8").trim()).toBe("lint:fix");
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      await exited;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 10000);
  it.each(["", "lint:fix", "format", "lint", "format:check", "typecheck"])(
    "runs all stages and preserves failure for %s",
    (failure) => {
      const dir = mkdtempSync(join(tmpdir(), "format-workflow-"));
      try {
        mkdirSync(join(dir, "scripts"));
        mkdirSync(join(dir, "bin"));
        copyFileSync(
          resolve("scripts/quality.mjs"),
          join(dir, "scripts/quality.mjs"),
        );
        copyFileSync(resolve("Makefile"), join(dir, "Makefile"));
        writeFileSync(
          join(dir, "bin/pnpm"),
          `#!${process.execPath}\nconst fs = require('node:fs');\nconst stage = process.argv[3];\nfs.appendFileSync(process.env.CALLS, stage + '\\n');\nif (stage === process.env.FAIL) process.exit(1);\n`,
          { mode: 0o755 },
        );
        const result = spawnSync("make", ["format"], {
          cwd: dir,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${join(dir, "bin")}${delimiter}${process.env.PATH ?? ""}`,
            CALLS: join(dir, "calls"),
            FAIL: failure,
          },
          timeout: 10000,
        });
        expect(result.status).toBe(failure ? 2 : 0);
        expect(
          readFileSync(join(dir, "calls"), "utf8").trim().split("\n"),
        ).toEqual(["lint:fix", "format", "lint", "format:check", "typecheck"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
