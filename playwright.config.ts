import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-report', open: 'never' }],
    ['junit', { outputFile: 'reports/junit-results.xml' }]
  ],
  use: {
    baseURL: process.env.API_BASE_URL ?? 'http://127.0.0.1:3000',
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
    screenshot: 'only-on-failure',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off'
  },
  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'database', testDir: './tests/database' },
    { name: 'e2e', testDir: './tests/e2e', use: { baseURL: process.env.WEB_APP_BASE_URL ?? 'http://127.0.0.1:5173' } }
  ]
});
