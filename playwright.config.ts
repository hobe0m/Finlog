import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e', fullyParallel:false, workers:1, timeout:45000,
  use:{baseURL:'http://localhost:3012',launchOptions:{channel:'msedge'},trace:'retain-on-failure'},
  webServer:{command:'node server/index.mjs',url:'http://localhost:3012',reuseExistingServer:false,env:{PORT:'3012',APP_ORIGIN:'http://localhost:3012',DATA_DIR:'.test-data',NODE_ENV:'test',EMAIL_API_KEY:''}},
});
