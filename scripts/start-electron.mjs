import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const rootUrl = new URL('..', import.meta.url);
const rootPath = fileURLToPath(rootUrl);
const mainFile = new URL('./dist-electron/main.js', rootUrl);
const devUrl = 'http://127.0.0.1:5173';

async function waitForFile(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await access(url);
      return;
    } catch {
      await delay(150);
    }
  }
  throw new Error(`Timed out waiting for ${url.pathname}`);
}

async function waitForHttp(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

await Promise.all([waitForFile(mainFile), waitForHttp(devUrl)]);

// Launch Electron directly. Spawning npx.cmd without a shell can throw
// EINVAL on Windows (notably with recent Node.js versions).
const child = spawn(electronPath, ['.'], {
  cwd: rootPath,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devUrl,
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
