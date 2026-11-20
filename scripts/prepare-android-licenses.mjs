#!/usr/bin/env node
// Fail-closed release preparation. Run BEFORE "npm run android:sync".
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const at = (path) => resolve(root, path);
const errors = [];
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const gitBlobSha = (data) => createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;
const readJson = async (path) => JSON.parse(await readFile(at(path), 'utf8'));
const packages = await readJson('package-lock.json');
const pkg = packages.packages?.['node_modules/stockfish'];
const inventory = await readJson('compliance/piece-assets.json');
const piecesRoot = at('mobile/public/pieces');
const required = [];
const found = [];
for (const set of inventory.sets ?? []) {
  if (set.paths) required.push(...set.paths);
  if (set.pathPattern) {
    for (const color of ['w', 'b']) {
      for (const name of ['P', 'N', 'B', 'R', 'Q', 'K']) {
        required.push(set.pathPattern.replace('{w,b}', color).replace('{P,N,B,R,Q,K}', name));
      }
    }
  }
  if (set.commercialUseApproved !== true || !hasValue(set.author) || !hasValue(set.sourceUrl) || !hasValue(set.license) || !hasValue(set.licenseEvidence)) {
    errors.push('Uncleared piece set: ' + set.id + ' (' + set.displayName + ')');
  }
}
for (const path of required) {
  try { const b = await readFile(at(path));
    const set = inventory.sets.find((item) => (item.paths ?? []).includes(path) || (item.pathPattern && path.startsWith(`mobile/public/pieces/${item.id}/`)));
    const basename = path.split('/').at(-1);
    const expectedBlob = set?.expectedGitBlobSha?.[basename];
    if (set?.expectedGitBlobSha && expectedBlob !== gitBlobSha(b)) errors.push('Artwork blob differs from verified upstream license evidence: ' + path);
    found.push({ path, sha256: sha256(b), gitBlobSha: gitBlobSha(b), sizeBytes: b.length });
  }
  catch { errors.push('Required artwork missing: ' + path); }
}
async function collect(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const item of entries) {
    const absolute = join(dir, item.name);
    if (item.isDirectory()) await collect(absolute);
    else if (item.isFile()) {
      const path = relative(root, absolute).replaceAll('\\', '/');
      if (!required.includes(path)) errors.push('Uninventoried art file: ' + path);
    }
  }
}
await collect(piecesRoot);
if (!pkg?.version || !pkg.integrity) errors.push('Missing locked Stockfish version/integrity in package-lock.json');
const binaries = [];
for (const name of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm', 'Stockfish-GPL-3.0.txt']) {
  const path = 'mobile/public/engine/' + name;
  try { const data = await readFile(at(path)); binaries.push({path, sha256: sha256(data), sizeBytes:data.length}); }
  catch { errors.push('Missing bundled engine file: ' + path + '; run npm run build:mobile first'); }
}

let source = null;
try {
  const a = await readJson('compliance/stockfish-source-attestation.json');
  const archivePath = 'release-sources/stockfish-corresponding-source.tar.gz';
  const archive = await readFile(at(archivePath));
  const actualHash = sha256(archive);
  for (const field of ['packageVersion','sourceRevision','sourceUrl','buildInstructions','reviewedBy','reviewDate','archiveSha256']) {
    if (!hasValue(a[field])) errors.push('Incomplete Stockfish source attestation field: ' + field);
  }
  if (a.packageVersion !== pkg?.version) errors.push('Attested Stockfish version does not equal locked npm version');
  if (!/^[a-f0-9]{64}$/i.test(a.archiveSha256 ?? '') || a.archiveSha256 !== actualHash) errors.push('Corresponding source archive SHA-256 does not match attestation');
  if (Object.values(a).some((value) => typeof value === 'string' && /REPLACE_WITH|YYYY-MM-DD/.test(value))) errors.push('Stockfish attestation contains template placeholders');
  if (!a.binaryMatchesSourceVerified) errors.push('Manual corresponding-source verification not attested');
  source = { archivePath, sha256: actualHash, sizeBytes: archive.length, attestation: a };
} catch(e) { errors.push('Missing/unreadable source archive or compliance/stockfish-source-attestation.json: ' + e.message); }

if (errors.length) {
  console.error('ANDROID THIRD-PARTY RELEASE GATE FAILED:');
  for (const error of errors) console.error(' - ' + error);
  process.exitCode = 1;
} else {
  const sourceTarget = at('mobile/public/engine/source/stockfish-corresponding-source.tar.gz');
  await mkdir(at('mobile/public/engine/source'), { recursive: true });
  await copyFile(at(source.archivePath), sourceTarget);
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    lockedStockfishVersion: pkg.version,
    lockedStockfishIntegrity: pkg.integrity,
    bundledFiles: binaries,
    correspondingSource: {
      path: 'engine/source/stockfish-corresponding-source.tar.gz',
      sha256: source.sha256,
      sizeBytes: source.sizeBytes,
      revision: source.attestation.sourceRevision,
      sourceUrl: source.attestation.sourceUrl,
      buildInstructions: source.attestation.buildInstructions
    },
    assets: found
  };
  await writeFile(at('mobile/public/engine/source/compliance-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Android license release gate passed. Source archive and manifest staged for mobile build.');
  console.log('Run npm run android:sync, then verify the archive and manifest inside the signed AAB.');
}
