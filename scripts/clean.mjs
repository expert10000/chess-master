import { rm } from 'node:fs/promises';

await Promise.all([
  rm(new URL('../dist', import.meta.url), { recursive: true, force: true }),
  rm(new URL('../dist-electron', import.meta.url), { recursive: true, force: true }),
]);
