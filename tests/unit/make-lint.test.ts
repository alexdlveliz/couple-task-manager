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
import { getFileInfo } from "prettier";

// Removing aggregation, argument-array dispatch, or signal forwarding must
// break these tests. Only external tool execution is replaced by a local child.
function fixture(fail = "") {
  const dir = mkdtempSync(join(tmpdir(), "quality workflow "));
  mkdirSync(join(dir, "scripts"));
  const runner = resolve("scripts/quality.mjs");
  if (existsSync(runner))
    copyFileSync(runner, join(dir, "scripts/quality.mjs"));
  copyFileSync(resolve("Makefile"), join(dir, "Makefile"));
  writeFileSync(join(dir, "maintained.ts"), "export const value = 1;\n");
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "pnpm"),
    `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS, JSON.stringify(args) + "\\n");
if (process.env.pnpm_config_verify_deps_before_run !== "false") {
  console.error("dependency installation preflight must be disabled");
  process.exit(91);
}
if (args.length !== 2 || args[0] !== "run") process.exit(90);
const stage = args[1];
console.log(stage + " native diagnostic");
if (stage === process.env.FAIL_STAGE) {
  console.error(stage + ": configuration missing or invalid");
  process.exit(2);
}
if (stage === process.env.WAIT_STAGE) {
  if (process.env.SPAWN_DESCENDANT === "1") {
    require("node:child_process").spawn(process.execPath, ["-e", 'const fs = require("node:fs"); process.on("SIGTERM", () => {}); process.on("SIGINT", () => {}); fs.writeFileSync(process.env.GRANDCHILD_PID, String(process.pid)); setInterval(() => {}, 1000);'], { stdio: "ignore" });
  }
  fs.writeFileSync(process.env.CHILD_PID, String(process.pid));
  process.on("SIGTERM", () => {
    fs.writeFileSync(process.env.STOPPED, "stopped");
    process.exit(0);
  });
  process.on("SIGINT", () => {
    fs.writeFileSync(process.env.STOPPED, "stopped");
    process.exit(0);
  });
  setInterval(() => {}, 1000);
}
`,
    { mode: 0o755 },
  );
  return {
    dir,
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      CALLS: join(dir, "calls"),
      CHILD_PID: join(dir, "pid"),
      STOPPED: join(dir, "stopped"),
      GRANDCHILD_PID: join(dir, "grandchild"),
      FAIL_STAGE: fail,
      ENV: "production",
    },
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function calls(file: string): unknown {
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as unknown);
}

describe("read-only quality workflow", () => {
  it.each([
    "fixture.secret.json",
    "fixture.secret.yaml",
    "fixture.secret.yml",
    "fixture.pem",
    "fixture.key",
    "fixture.p12",
    "fixture.pfx",
    "fixture.crt",
  ])("excludes credential fixture %s from formatting", async (file) => {
    const info = await getFileInfo(file, {
      ignorePath: resolve(".prettierignore"),
    });
    expect(info.ignored).toBe(true);
  });

  it("kills a signal-ignoring descendant after pnpm exits", async () => {
    const f = fixture();
    const child = spawn(process.execPath, ["scripts/quality.mjs"], {
      cwd: f.dir,
      env: { ...f.env, WAIT_STAGE: "lint", SPAWN_DESCENDANT: "1" },
      stdio: "ignore",
    });
    const exited = once(child, "exit");
    try {
      const deadline = Date.now() + 5000;
      while (
        !existsSync(f.env.GRANDCHILD_PID) &&
        child.exitCode === null &&
        Date.now() < deadline
      ) {
        await new Promise((done) => setTimeout(done, 20));
      }
      expect(existsSync(f.env.GRANDCHILD_PID)).toBe(true);
      const pid = Number(readFileSync(f.env.GRANDCHILD_PID, "utf8"));
      child.kill("SIGTERM");
      const code: unknown = (await exited)[0];
      expect(code).not.toBe(0);
      expect(calls(f.env.CALLS)).toEqual([["run", "lint"]]);
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      if (existsSync(f.env.GRANDCHILD_PID)) {
        try {
          process.kill(
            Number(readFileSync(f.env.GRANDCHILD_PID, "utf8")),
            "SIGKILL",
          );
        } catch {
          // Already stopped by the runner.
        }
      }
      if (child.exitCode === null) child.kill("SIGKILL");
      await exited;
      f.cleanup();
    }
  }, 10000);

  it("dispatches make lint without services or environment selection", () => {
    const f = fixture();
    try {
      const before = readFileSync(join(f.dir, "maintained.ts"));
      const result = spawnSync("make", ["lint"], {
        cwd: f.dir,
        env: f.env,
        encoding: "utf8",
        timeout: 10000,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(calls(f.env.CALLS)).toEqual([
        ["run", "lint"],
        ["run", "format:check"],
        ["run", "typecheck"],
      ]);
      expect(readFileSync(join(f.dir, "maintained.ts"))).toEqual(before);
      for (const stage of ["lint", "format:check", "typecheck"]) {
        expect(result.stdout).toContain(`[quality] ${stage}`);
        expect(result.stdout).toContain(`${stage} native diagnostic`);
      }
    } finally {
      f.cleanup();
    }
  });

  it.each(["lint", "format:check", "typecheck"])(
    "preserves a failing %s stage while running all checks",
    (stage) => {
      const f = fixture(stage);
      try {
        const result = spawnSync(process.execPath, ["scripts/quality.mjs"], {
          cwd: f.dir,
          env: f.env,
          encoding: "utf8",
          timeout: 10000,
        });
        expect(result.status).toBe(1);
        expect(calls(f.env.CALLS)).toEqual([
          ["run", "lint"],
          ["run", "format:check"],
          ["run", "typecheck"],
        ]);
        expect(result.stderr).toContain(`[quality] ${stage} failed`);
        expect(result.stderr).toContain("configuration missing or invalid");
      } finally {
        f.cleanup();
      }
    },
  );

  it("reports missing pnpm for every stage and returns failure", () => {
    const f = fixture();
    try {
      const result = spawnSync(process.execPath, ["scripts/quality.mjs"], {
        cwd: f.dir,
        env: { ...f.env, PATH: "" },
        encoding: "utf8",
        timeout: 10000,
      });
      expect(result.status).toBe(1);
      for (const stage of ["lint", "format:check", "typecheck"]) {
        expect(result.stderr).toContain(
          `[quality] ${stage}: could not start pnpm`,
        );
      }
      expect(result.stderr).toContain("PATH");
      expect(result.stderr).toContain("pnpm install --frozen-lockfile");
    } finally {
      f.cleanup();
    }
  });

  it.each(["SIGINT", "SIGTERM"] as const)(
    "stops the active child and subsequent stages on %s",
    async (signal) => {
      const f = fixture();
      const child = spawn(process.execPath, ["scripts/quality.mjs"], {
        cwd: f.dir,
        env: { ...f.env, WAIT_STAGE: "lint" },
        stdio: "ignore",
      });
      const exited = once(child, "exit");
      try {
        const deadline = Date.now() + 5000;
        while (
          !existsSync(f.env.CHILD_PID) &&
          child.exitCode === null &&
          Date.now() < deadline
        ) {
          await new Promise((done) => setTimeout(done, 20));
        }
        expect(existsSync(f.env.CHILD_PID)).toBe(true);
        const pid = Number(readFileSync(f.env.CHILD_PID, "utf8"));
        child.kill(signal);
        const code: unknown = (await exited)[0];
        expect(code).not.toBe(0);
        expect(calls(f.env.CALLS)).toEqual([["run", "lint"]]);
        expect(existsSync(f.env.STOPPED)).toBe(true);
        expect(() => process.kill(pid, 0)).toThrow();
      } finally {
        if (existsSync(f.env.CHILD_PID)) {
          try {
            process.kill(
              Number(readFileSync(f.env.CHILD_PID, "utf8")),
              "SIGKILL",
            );
          } catch {
            // Already stopped by the runner.
          }
        }
        if (child.exitCode === null) child.kill("SIGKILL");
        await exited;
        f.cleanup();
      }
    },
    10000,
  );
});
