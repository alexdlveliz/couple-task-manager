import { defineConfig, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Firefox on macOS 27 otherwise attempts to read a TCC-protected real profile.
const firefoxData = join(tmpdir(), 'shared-task-board-firefox');
if (process.platform === 'darwin') mkdirSync(firefoxData, { recursive:true });

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  // WebKit may stall while closing competing contexts on macOS.
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8787', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], ...(process.platform === 'darwin' ? { launchOptions: { env: { ...process.env, CFFIXED_USER_HOME: firefoxData } } } : {}) } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
});
