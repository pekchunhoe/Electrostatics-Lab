import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',timeout:45000,fullyParallel:false,workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure'},webServer:{command:'node scripts/server.mjs',url:'http://127.0.0.1:5173',reuseExistingServer:true,timeout:30000}});
