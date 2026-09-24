import { spawnSync } from 'node:child_process'

// Opt-in: a failing public API must not make deterministic regression tests flaky.
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
  stdio: 'inherit',
  env: { ...process.env, LIVE_API: '1' },
})
process.exitCode = result.status ?? 1
