export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  FIREBASE_PROJECT_ID: string;
  AUTH_MODE: "production" | "emulator";
  ENVIRONMENT?: string;
  FIREBASE_AUTH_EMULATOR_HOST?: string;
}

export function validateEnvironment(env: Env, local = false): void {
  if (
    !env.FIREBASE_PROJECT_ID ||
    !["production", "emulator"].includes(env.AUTH_MODE)
  )
    throw new Error("Invalid authentication configuration");
  if (
    env.AUTH_MODE === "emulator" &&
    (!local ||
      env.ENVIRONMENT !== "local" ||
      env.FIREBASE_PROJECT_ID !== "demo-shared-task-board")
  )
    throw new Error("Emulator mode requires the local demo project");
  if (
    env.AUTH_MODE === "production" &&
    (env.FIREBASE_AUTH_EMULATOR_HOST || env.ENVIRONMENT === "local")
  )
    throw new Error("Emulator configuration is forbidden in production");
}
