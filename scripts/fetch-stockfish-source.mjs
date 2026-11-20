#!/usr/bin/env node
// Download a pinned upstream candidate source archive.
// This does NOT attest that source is complete or matches compiled binaries.
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
const root = process.cwd();
const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
const version = lock.packages?.['node_modules/stockfish']?.version;
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) throw Error('Cannot determine exact Stockfish package from lockfile.');
const url = 'https://codeload.github.com/nmrugg/stockfish.js/tar.gz/refs/tags/v' + version;
const destinationDir = resolve(root, 'release-sources');
const destination = resolve(destinationDir, 'stockfish-corresponding-source.tar.gz');
const temporary = destination + '.download';
await mkdir(destinationDir, { recursive: true });
const response = await fetch(url, { redirect: 'error' });
if (!response.ok || !response.body) throw Error('Upstream archive request failed: HTTP ' + response.status + '; ' + url);
try {
  await rm(temporary, { force: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx' }));
  const bytes = await readFile(temporary);
  const checksum = createHash('sha256').update(bytes).digest('hex');
  await rename(temporary, destination);
  console.log('Downloaded upstream tag v' + version + ' candidate source to ' + destination);
  console.log('Source archive SHA-256: ' + checksum);
  console.log('Upstream URL: ' + url);
  console.log('IMPORTANT: Do not set binaryMatchesSourceVerified=true without inspecting archive, network inputs, build scripts and exact JS/WASM binary correspondence.');
  console.log('The release remains blocked until full attestation and artwork evidence are complete.');
} catch(error) {
  await rm(temporary, { force: true });
  throw error;
}
