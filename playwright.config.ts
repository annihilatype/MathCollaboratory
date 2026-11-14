import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: { executablePath: process.env.CHROMIUM_PATH } } },
    { name: 'webkit', testMatch: ['**/navigation.spec.ts','**/mapping.spec.ts','**/regions.spec.ts','**/input-regions.spec.ts','**/tfkp.spec.ts'], use: { browserName: 'webkit' } },
  ],
  webServer: { command: 'pnpm dev --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
