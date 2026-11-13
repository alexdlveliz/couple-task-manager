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
try {
  await checkPorts([9099, 4000, 8787, 5173]);
  validateLocalConfiguration();
  validatePrerequisites();
  const auth = supervisor.start("Auth emulator", [
    "exec",
    "firebase",
    "emulators:start",
    "--only",
    "auth",
    "--project",
    "demo-shared-task-board",
  ]);
  const authStopped = new Promise((resolve) => {
    auth.once("exit", () => resolve("Auth emulator stopped unexpectedly."));
    auth.once("error", () => resolve("Auth emulator could not start."));
  });
  const guardAuth = async (operation) => {
    const result = await Promise.race([
      operation.then(() => null),
      authStopped,
    ]);
    if (result) throw new Error(result);
  };
  await guardAuth(supervisor.ready("Auth emulator", auth, 9099));
  await guardAuth(
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
  );
  await guardAuth(supervisor.step("local fixtures", ["run", "seed:local"]));
  const app = supervisor.start("application", ["run", "dev"]);
  const appStopped = new Promise((resolve) => {
    app.once("exit", () => resolve("Application stopped unexpectedly."));
    app.once("error", () => resolve("Application could not start."));
  });
  await guardAuth(supervisor.ready("Worker", app, 8787));
  await guardAuth(supervisor.ready("application", app, 5173));
  console.log(
    "Application ready at http://127.0.0.1:5173. Press Ctrl-C to stop.",
  );
  const result = await Promise.race([authStopped, appStopped]);
  if (!interrupted) throw new Error(result);
} catch (error) {
  if (!interrupted) {
    console.error(error.message);
    process.exitCode = 1;
  }
} finally {
  await supervisor.cleanup();
}
