import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const database = join(mkdtempSync(join(tmpdir(),'sejour-e2e-')),'rentals.sqlite');
export default defineConfig({
  testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:30000,
  use:{baseURL:'http://127.0.0.1:3100',headless:true,trace:'retain-on-failure',launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{}},
  webServer:{command:'npm run start -- --port 3100',url:'http://127.0.0.1:3100',reuseExistingServer:false,env:{RENTAL_DB_PATH:database},timeout:30000},
});
