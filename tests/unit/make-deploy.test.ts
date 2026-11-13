import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

function fixture(config = readFileSync("wrangler.jsonc", "utf8")) {
  const dir = mkdtempSync(join(tmpdir(), "deploy-workflow-"));
  mkdirSync(join(dir, "scripts"));
  mkdirSync(join(dir, "src/worker"), { recursive: true });
  writeFileSync(join(dir, "src/worker/index.ts"), "");
  copyFileSync(resolve("Makefile"), join(dir, "Makefile"));
  // The target script is copied once implemented; node_modules is used only by node, never pnpm.
  if (existsSync(resolve("scripts/deploy.mjs")))
    copyFileSync(
      resolve("scripts/deploy.mjs"),
      join(dir, "scripts/deploy.mjs"),
    );
  symlinkSync(resolve("node_modules"), join(dir, "node_modules"), "dir");
  writeFileSync(join(dir, "wrangler.jsonc"), config);
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "pnpm"),
    `#!/bin/sh\nprintf '%s\\n' "$*" >> "$DEPLOY_CALLS"\nprintf '%s' "$NODE_ENV" > "$DEPLOY_NODE_ENV"\nprintf '%s\\n' 'secret-token task-content'\ncase "$*" in *"$DEPLOY_FAIL"*) [ -z "$DEPLOY_FAIL" ] || exit 9;; esac\n`,
    { mode: 0o755 },
  );
  const env: NodeJS.ProcessEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("VITE_") && key !== "ENV",
    ),
  );
  Object.assign(env, {
    PATH: `${bin}${delimiter}${String(process.env.PATH)}`,
    DEPLOY_CALLS: join(dir, "calls"),
    DEPLOY_NODE_ENV: join(dir, "node-env"),
    NODE_ENV: "development",
    DEPLOY_FAIL: "",
    VITE_FIREBASE_PROJECT_ID: "couple-task-scheduler",
    VITE_FIREBASE_API_KEY: "test-real-key",
    VITE_FIREBASE_AUTH_DOMAIN: "couple-task-scheduler.firebaseapp.com",
    VITE_USE_AUTH_EMULATOR: "false",
  });
  return {
    dir,
    env,
    calls: join(dir, "calls"),
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("make deploy", () => {
  it.each([undefined, "", "local", "production"])(
    "rejects environment %s before building",
    (value) => {
      const f = fixture();
      try {
        const result = spawnSync(
          "make",
          value === undefined ? ["deploy"] : ["deploy", `ENV=${value}`],
          { cwd: f.dir, env: f.env, encoding: "utf8" },
        );
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/environment/i);
        expect(existsSync(f.calls)).toBe(false);
      } finally {
        f.cleanup();
      }
    },
  );

  it.each(["{invalid", '{"env":{"dev":{}}}'])(
    "rejects incomplete configuration before building",
    (config) => {
      const f = fixture(config);
      try {
        const result = spawnSync("make", ["deploy", "ENV=dev"], {
          cwd: f.dir,
          env: f.env,
          encoding: "utf8",
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/configuration/i);
        expect(existsSync(f.calls)).toBe(false);
      } finally {
        f.cleanup();
      }
    },
  );

  it.each([
    ["VITE_FIREBASE_PROJECT_ID", "other-project"],
    ["VITE_FIREBASE_API_KEY", "demo-api-key"],
    ["VITE_FIREBASE_AUTH_DOMAIN", "localhost:9099"],
    ["VITE_FIREBASE_AUTH_DOMAIN", "other-project.firebaseapp.com"],
    ["VITE_FIREBASE_AUTH_DOMAIN", "bad..example.com"],
    ["VITE_USE_AUTH_EMULATOR", "true"],
  ])("rejects unsafe or inconsistent %s before building", (key, value) => {
    const f = fixture();
    f.env[key] = value;
    try {
      const result = spawnSync("make", ["deploy", "ENV=dev"], {
        cwd: f.dir,
        env: f.env,
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/configuration/i);
      expect(existsSync(f.calls)).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  it.each([
    [
      "AUTH_MODE",
      (config: string) =>
        config.replace('"AUTH_MODE": "production"', '"AUTH_MODE": "emulator"'),
    ],
    [
      "D1 database ID",
      (config: string) =>
        config.replaceAll(
          "09ad1f2f-026e-4e80-8dc8-1ae3f6cd242e",
          "00000000-0000-0000-0000-000000000000",
        ),
    ],
    [
      "wrong asset directory",
      (config: string) =>
        config.replace('"directory": "./dist"', '"directory": "./other"'),
    ],
    [
      "dev asset directory",
      (config: string) =>
        config.replace('"dev": {', '"dev": { "assets": { "directory": "" },'),
    ],
    [
      "missing Worker entry",
      (config: string) =>
        config.replace("src/worker/index.ts", "src/worker/missing.ts"),
    ],
    [
      "Worker entry",
      (config: string) =>
        config.replace("src/worker/index.ts", "src/worker/local.ts"),
    ],
  ])("rejects unsafe %s settings before building", (_name, change) => {
    const f = fixture(change(readFileSync("wrangler.jsonc", "utf8")));
    try {
      const result = spawnSync("make", ["deploy", "ENV=dev"], {
        cwd: f.dir,
        env: f.env,
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/configuration/i);
      expect(existsSync(f.calls)).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  it("loads .env.dev over local demo and ignores .env.production.local", () => {
    const f = fixture();
    for (const key of Object.keys(f.env))
      if (key.startsWith("VITE_")) Reflect.deleteProperty(f.env, key);
    writeFileSync(
      join(f.dir, ".env.local"),
      "VITE_FIREBASE_PROJECT_ID=demo-shared-task-board\nVITE_FIREBASE_API_KEY=demo-api-key\nVITE_FIREBASE_AUTH_DOMAIN=demo-shared-task-board.firebaseapp.com\nVITE_USE_AUTH_EMULATOR=true\n",
    );
    writeFileSync(
      join(f.dir, ".env.dev"),
      "VITE_FIREBASE_PROJECT_ID=couple-task-scheduler\nVITE_FIREBASE_API_KEY=test-real-key\nVITE_FIREBASE_AUTH_DOMAIN=couple-task-scheduler.firebaseapp.com\nVITE_USE_AUTH_EMULATOR=false\n",
    );
    writeFileSync(
      join(f.dir, ".env.production.local"),
      "VITE_FIREBASE_PROJECT_ID=wrong-project\nVITE_USE_AUTH_EMULATOR=true\n",
    );
    try {
      const result = spawnSync("make", ["deploy", "ENV=dev"], {
        cwd: f.dir,
        env: f.env,
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
    } finally {
      f.cleanup();
    }
  });

  it("builds for production and deploys only to dev without migrations or sensitive output", () => {
    const f = fixture();
    try {
      const result = spawnSync("make", ["deploy", "ENV=dev"], {
        cwd: f.dir,
        env: f.env,
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(f.calls, "utf8").trim().split("\n")).toEqual([
        "run build:dev",
        "exec wrangler deploy --env dev",
      ]);
      expect(readFileSync(join(f.dir, "node-env"), "utf8")).toBe("production");
      expect(result.stdout + result.stderr).not.toMatch(
        /secret-token|task-content/,
      );
    } finally {
      f.cleanup();
    }
  });

  it.each(["build:dev", "deploy --env dev"])(
    "reports a failed %s step without exposing output",
    (step) => {
      const f = fixture();
      f.env.DEPLOY_FAIL = step;
      try {
        const result = spawnSync("make", ["deploy", "ENV=dev"], {
          cwd: f.dir,
          env: f.env,
          encoding: "utf8",
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/failed/i);
        expect(result.stdout + result.stderr).not.toMatch(
          /secret-token|task-content/,
        );
        if (step === "build:dev")
          expect(readFileSync(f.calls, "utf8")).not.toMatch(/wrangler/);
      } finally {
        f.cleanup();
      }
    },
  );
});
