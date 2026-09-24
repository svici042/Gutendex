import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: process.env.LIVE_API ? '**/live.spec.js' : '**/*.spec.js',
  testIgnore: process.env.LIVE_API ? [] : ['**/live.spec.js'],
  workers: process.env.LIVE_API ? 2 : 1,
  fullyParallel: Boolean(process.env.LIVE_API),
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: [{
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  }, ...(!process.env.LIVE_API ? [{
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    env: { VITE_GUTENDEX_API_URL: 'https://gutendex.com' },
    reuseExistingServer: false,
  }, {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    env: { VITE_GUTENDEX_API_URL: 'http://127.0.0.1:4999', VITE_API_TIMEOUT_MS: '2000' },
    reuseExistingServer: false,
  }] : [])],
})
