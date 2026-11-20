#!/usr/bin/env node
// Prepare a source candidate with the lite NNUE input embedded in the archive.
// This verifies the NNUE content-addressed name; it does NOT reproduce the WASM
// compilation or grant automatic source-to-binary attestation.
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const root = process.cwd();
const sha256 = data => createHash('sha256').update(data).digest('hex');
const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
const version = lock.packages?.['node_modules/stockfish']?.version;
if (version !== '19.0.1') throw Error('This pinned source preparer supports only the audited stockfish@19.0.1; inspect a new version separately.');
const sourceRevision = '0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6';
const netName = 'nn-61e7af4bb97d.nnue';
const tagUrl = 'https://codeload.github.com/nmrugg/stockfish.js/tar.gz/' + sourceRevision;
const nnueUrls = [
  'https://tests.stockfishchess.org/api/nn/' + netName,
  'https://raw.githubusercontent.com/official-stockfish/networks/master/' + netName,
];
const destinationDir = resolve(root, 'release-sources');
const destination = join(destinationDir, 'stockfish-corresponding-source.tar.gz');
const workspace = await mkdtemp(join(tmpdir(), 'chess-coach-source-'));
function runArchiveTool(args) {
  const python = process.platform === 'win32' ? 'py' : 'python3';
  const argv = process.platform === 'win32' ? ['-3', 'scripts/stockfish-source-archive.py', ...args] : ['scripts/stockfish-source-archive.py', ...args];
  const result = spawnSync(python, argv, {cwd:root,encoding:'utf8'});
  if(result.error || result.status !== 0) throw Error('Python source archiver failed: ' + (result.error?.message ?? result.stderr));
  if(result.stdout) console.log(result.stdout.trim());
}
async function download(url, file) {
  const response = await fetch(url, {redirect: 'follow'});
  if (!response.ok || !response.body) throw Error('Download failed with HTTP ' + response.status + ': ' + url);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file, {flags: 'wx'}));
}
try {
  const original = join(workspace, 'tag.tar.gz');
  await download(tagUrl, original);
  let netBytes;
  let netSource;
  for (const url of nnueUrls) {
    try {
      const response = await fetch(url, {redirect:'follow'});
      if (!response.ok) continue;
      const body = Buffer.from(await response.arrayBuffer());
      if (sha256(body).slice(0, 12) !== netName.slice(3, 15)) throw Error('NNUE SHA-256 prefix mismatch');
      netBytes = body;
      netSource = url;
      break;
    } catch(e) {
      console.warn('Network candidate rejected: ' + e.message);
    }
  }
  if (!netBytes) throw Error('Could not download and validate required Stockfish lite NNUE network');
  await mkdir(destinationDir, {recursive:true});
  const staged = join(workspace, 'corresponding-source.tar.gz');
  const netFile = join(workspace, netName);
  await writeFile(netFile, netBytes);
  runArchiveTool(['assemble', original, netFile, staged]);
  const archive = await readFile(staged);
  const hash = sha256(archive);
  await rename(staged, destination);
  const draftPath = resolve(root, 'compliance/stockfish-source-attestation.json');
  const draft = {
    packageVersion: version,
    sourceRevision,
    sourceUrl: tagUrl,
    liteNetworkUrl: netSource,
    liteNetworkName: netName,
    liteNetworkSha256: sha256(netBytes),
    buildInstructions: 'Install Emscripten 6.0.9, then npm run build-single-lite from this source tree; compare rebuilt JS/WASM to the exact npm distribution.',
    reviewedBy: '',
    reviewDate: '',
    archiveSha256: hash,
    binaryMatchesSourceVerified: false,
  };
  try {
    await writeFile(draftPath, JSON.stringify(draft, null, 2) + '\n', {flag:'wx'});
    console.log('Created UNVERIFIED attestation draft: ' + draftPath);
  } catch(e) {
    if (e.code !== 'EEXIST') throw e;
    const existing = JSON.parse(await readFile(draftPath,'utf8'));
    if (existing.archiveSha256 !== hash) console.warn('Existing attestation hash differs. Reconcile manually; it was not overwritten.');
  }
  console.log('Complete source CANDIDATE:', destination);
  console.log('Archive SHA-256:', hash);
  console.log('Lite NNUE SHA-256:', draft.liteNetworkSha256);
  console.log('IMPORTANT: source-to-binary reproducibility is NOT established by this download. Keep binaryMatchesSourceVerified=false pending actual compiler-based or independently corroborated verification.');
} finally {
  await rm(workspace, {recursive:true,force:true});
}
