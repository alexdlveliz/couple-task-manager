import { spawn } from "node:child_process";

const stages = ["lint", "format:check", "typecheck"];
let active;
let interrupted;
let forcedStop;
let failed = false;

function stopChild(pid, signal) {
  if (!pid) return;
  try {
    // pnpm launches the tool as a child: stop its process group as well.
    if (process.platform === "win32") process.kill(pid, signal);
    else process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") {
      console.error(`[quality] Could not stop active check: ${error.message}`);
      failed = true;
    }
  }
}

function interrupt(signal) {
  if (interrupted) return;
  interrupted = signal;
  console.error(`[quality] Interrupted (${signal}); stopping checks.`);
  const pid = active?.pid;
  stopChild(pid, signal);
  // A tool that ignores the initial signal must not hang the workflow.
  forcedStop = new Promise((resolve) => {
    setTimeout(() => {
      stopChild(pid, "SIGKILL");
      resolve();
    }, 1000);
  });
}

process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);

try {
  for (const stage of stages) {
    if (interrupted) break;
    console.log(`[quality] ${stage}`);
    const child = spawn("pnpm", ["run", stage], {
      stdio: "inherit",
      detached: process.platform !== "win32",
      // pnpm 12 defaults to installing out-of-date dependencies before run.
      // Checks must report missing tools, never install or contact a registry.
      env: { ...process.env, pnpm_config_verify_deps_before_run: "false" },
    });
    active = child;
    let spawnFailed = false;
    const code = await new Promise((resolve) => {
      child.once("error", (error) => {
        spawnFailed = true;
        console.error(
          `[quality] ${stage}: could not start pnpm (${error.message}). Check pnpm on PATH and run pnpm install --frozen-lockfile.`,
        );
      });
      child.once("close", (status) => resolve(status));
    });
    active = undefined;
    if (spawnFailed || code !== 0) {
      failed = true;
      console.error(
        `[quality] ${stage} failed; review the diagnostics above and check installed dependencies/configuration.`,
      );
    }
  }
} finally {
  // Keep the captured process group alive in cleanup even if pnpm exited first.
  await forcedStop;
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", interrupt);
}

process.exitCode =
  interrupted === "SIGINT" ? 130 : interrupted ? 143 : failed ? 1 : 0;
