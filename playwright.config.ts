import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e', fullyParallel:false, workers:1, timeout:45000,
  use:{baseURL:'http://localhost:3012/Finlog/',launchOptions:{channel:process.platform==='win32'?'msedge':undefined},trace:'retain-on-failure'},
  webServer:{command:'node scripts/preview-pages.mjs',url:'http://localhost:3012/Finlog/',reuseExistingServer:false},
});
