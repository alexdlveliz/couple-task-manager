# Real-device quickstart

This guide runs the shared task board locally on a Mac and opens it on real Android phones. The app, Firebase Auth emulator, and D1 database remain on the Mac; Android USB port forwarding lets each phone reach them. No production account or deployment is needed.

The current local configuration is ready for Android over USB. It is not ready for direct Wi-Fi or iPhone access: the client and emulators use `127.0.0.1`, which on a phone refers to that phone. See [iPhone and Wi-Fi testing](#iphone-and-wi-fi-testing) below.

## Requirements

- Node.js 22.12 or later in a supported release line
- pnpm 12.16.1
- Java supported by the installed Firebase Emulator version
- Android SDK Platform Tools (`adb`) and a data-capable USB cable
- One or more Android phones with USB debugging enabled

From the repository root, confirm the tools are available:

```sh
node --version
pnpm --version
java -version
adb version
```

Install the locked dependencies and create local configuration files if they do not already exist:

```sh
pnpm install --frozen-lockfile
cp -n .env.example .env.local
cp -n .dev.vars.example .dev.vars.local
```

The example configuration uses the demo Firebase project and local Auth emulator. Keep `.env.local` and `.dev.vars.local` on your machine; do not commit them.

## Start the local services

Use three terminal windows, all opened at the repository root.

In **Terminal 1**, start the Firebase Authentication emulator and leave it running:

```sh
pnpm exec firebase emulators:start --only auth --project demo-shared-task-board
```

Wait for Auth to be ready on port `9099`.

In **Terminal 2**, apply the local D1 migrations, create or reuse the demo accounts and partner rows, and build the app:

```sh
pnpm exec wrangler d1 migrations apply shared-task-board --local --env local
pnpm run seed:local
pnpm run build
```

Then start the local Worker preview and leave it running:

```sh
pnpm run preview:worker
```

The app is served at `http://127.0.0.1:8787`. Open it on the Mac first to confirm the sign-in page loads. Use the Worker preview for device and offline checks because it serves the built app and service worker. Do not run `pnpm run dev` at the same time; it also uses port `8787`.

## Connect an Android phone over USB

On the phone, enable **Developer options** and **USB debugging** (the exact menus vary by manufacturer), then connect it to the Mac. Unlock the phone and approve the USB debugging prompt.

In **Terminal 3**, check that the device is authorized:

```sh
adb devices
```

The device should show status `device`. If it shows `unauthorized`, accept the prompt on the phone and run the command again.

Forward the app and Auth emulator ports from the phone to the Mac:

```sh
adb reverse tcp:8787 tcp:8787
adb reverse tcp:9099 tcp:9099
```

On the phone, open Chrome and visit:

```text
http://127.0.0.1:8787
```

`adb reverse` makes the phone's loopback connection to those ports reach the Mac. The app can therefore keep using its configured `127.0.0.1:9099` Auth emulator address.

### Connect a second Android phone

Connect and authorize the second phone too. List device serials with `adb devices`, then forward both ports for each phone, substituting its serial:

```sh
adb -s DEVICE_SERIAL reverse tcp:8787 tcp:8787
adb -s DEVICE_SERIAL reverse tcp:9099 tcp:9099
```

Open `http://127.0.0.1:8787` on both phones. Both use the same local Worker and D1 board on the Mac. A phone and a separate browser profile on the Mac can also be used as the two partners.

## Local test accounts

Use these fixture accounts only with the local Auth emulator:

| Account                  | Password                       |
| ------------------------ | ------------------------------ |
| `partner-a@example.test` | `local-demo-password-a`        |
| `partner-b@example.test` | `local-demo-password-b`        |
| `outsider@example.test`  | `local-demo-password-outsider` |

The first two accounts are the authorized partners. The outsider is useful for confirming that a signed-in, unauthorized user cannot read the board. The seeder is restricted to the local demo project and local D1. See [scripts/README.md](scripts/README.md) for fixture details.

## Suggested device checks

1. Sign in as partner A on one device and partner B on the other.
2. Create a task on A and assign it to B. Confirm it appears on B after synchronization.
3. Edit the task on B, change its assignee or status, and confirm the update appears on A.
4. Repeat with the partners' roles reversed. Both partners should have equal access to every task.
5. Sign in as the outsider in a separate browser profile. The board should remain inaccessible.
6. Check the Spanish UI at phone width, including form controls, error messages, focus, and keyboard behavior.

### Check offline reopening

Load the board successfully while connected and keep the same browser profile. Give the app time to save its shell and authorized board snapshot. Then disconnect the phone from the Mac's forwarded services (for example, unplug USB) and reopen the same URL in that profile. The expected behavior is a stale/offline notice, the last saved board, and disabled saving. Reconnect USB and restore the `adb reverse` mappings if needed; the phone should synchronize with the server copy when it can reach it again.

Offline availability depends on the browser retaining its service worker and local storage. The browser may clear those. Follow the fuller scenarios in [the feature quickstart](specs/001-shared-task-board/quickstart.md) and review [validation notes](specs/001-shared-task-board/validation.md) before claiming acceptance coverage.

## iPhone and Wi-Fi testing

The checked-in local setup does not provide a phone-reachable Wi-Fi URL or an iPhone-ready local HTTPS setup. Its servers bind to loopback, and the client connects to the Auth emulator at `127.0.0.1:9099`; on an iPhone, that address points to the iPhone itself. Also, a plain HTTP address using the Mac's LAN IP does not provide the secure context needed to exercise service-worker behavior consistently.

For representative iPhone testing, prepare a separate HTTPS staging environment with its own Cloudflare D1 database, Firebase project, and two private test accounts. Configure the production Firebase web settings and Worker trust values, seed only the two test-account UIDs in staging D1, apply migrations, build without the Auth emulator, and deploy the production Worker entry point. The current production values in `wrangler.jsonc` are placeholders; do not deploy the checked-in configuration unchanged. Follow the production requirements and controlled pre-publish checks in [README.md](README.md). Never expose the demo Auth emulator to an untrusted network.

## Troubleshooting

- **The phone cannot load the app:** Confirm both Terminal 1 and Terminal 2 are still running, the phone is authorized in `adb devices`, and both reverse mappings were set. Repeat the two `adb reverse` commands after reconnecting USB.
- **The sign-in screen loads, but sign-in fails:** Confirm the Auth emulator is ready on the Mac and port `9099` is forwarded. With the emulator running, rerun `pnpm run seed:local`.
- **Port `8787` is already in use:** Stop the other Worker, including one started by `pnpm run dev`, then restart `pnpm run preview:worker`.
- **The board is not shared between devices:** Make sure both phones visit `http://127.0.0.1:8787` through their own USB reverse mappings and that one is signed in as partner A, the other as partner B.
- **Offline reopening does not work:** Use the built Worker preview, load the board online first, wait for it to finish synchronizing, and reopen the exact same URL using the same browser profile.

## Stop the local services

Press `Ctrl+C` in Terminal 1 and Terminal 2 when finished. The emulator and local D1 are demo-only; these steps do not deploy the app or change production data.
