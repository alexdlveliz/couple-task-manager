import {
  Supervisor,
  checkPorts,
  validateLocalConfiguration,
  validatePrerequisites,
} from "./workflow-common.mjs";

const supervisor = new Supervisor();
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    interrupted = true;
    void supervisor
      .cleanup()
      .then(() => process.exit(signal === "SIGINT" ? 130 : 143));
  });
}
const watch = (child, name) =>
  new Promise((resolve) => {
    child.once("exit", () => resolve(`${name} stopped unexpectedly.`));
    child.once("error", () => resolve(`${name} could not start.`));
  });
const guarded = async (operation, ...services) => {
  const failure = await Promise.race([operation.then(() => null), ...services]);
  if (failure) throw new Error(failure);
};
try {
  await checkPorts([9099, 4000, 8787]);
  validateLocalConfiguration();
  validatePrerequisites();
  for (const step of ["typecheck", "test:unit", "test:integration", "build"]) {
    await supervisor.step(step, ["run", step]);
  }
  const auth = supervisor.start("Auth emulator", [
    "exec",
    "firebase",
    "emulators:start",
    "--only",
    "auth",
    "--project",
    "demo-shared-task-board",
  ]);
  const authStopped = watch(auth, "Auth emulator");
  await guarded(supervisor.ready("Auth emulator", auth, 9099), authStopped);
  await guarded(
    supervisor.step("local migrations", [
      "exec",
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "DB",
      "--env",
      "local",
      "--local",
    ]),
    authStopped,
  );
  await guarded(
    supervisor.step("local fixtures", ["run", "seed:local"]),
    authStopped,
  );
  const preview = supervisor.start("Worker preview", ["run", "preview:worker"]);
  const previewStopped = watch(preview, "Worker preview");
  await guarded(
    supervisor.ready("Worker preview", preview, 8787),
    authStopped,
    previewStopped,
  );
  await guarded(
    supervisor.step("test:browser", ["run", "test:browser"]),
    authStopped,
    previewStopped,
  );
  console.log("All checks passed.");
} catch (error) {
  if (!interrupted) {
    console.error(error.message);
    process.exitCode = 1;
  }
} finally {
  await supervisor.cleanup();
}
