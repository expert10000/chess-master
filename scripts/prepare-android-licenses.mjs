#!/usr/bin/env node
// Fail-closed release preparation. Run BEFORE "npm run android:sync".
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const at = (path) => resolve(root, path);
const errors = [];
const reviewCandidate = process.argv.slice(2).length === 1 && process.argv[2] === '--review-candidate';
if (process.argv.length > 2 && !reviewCandidate) {
  console.error('Usage: node scripts/prepare-android-licenses.mjs [--review-candidate]');
  process.exit(2);
}
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
const noticeFiles = [];
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
      if (!required.includes(path)) {
        if (/\.(?:txt|md|license)$/i.test(item.name) || /^(?:LICENSE|LICENCE|COPYING|CREDITS|ATTRIBUTION|NOTICE|README)(?:\.[a-z0-9_-]+)?$/i.test(item.name)) {
          const notice = await readFile(absolute);
          noticeFiles.push({path, sha256: sha256(notice), sizeBytes: notice.length});
          if (notice.length === 0) errors.push('Empty artwork attribution/license document: ' + path);
        } else {
          errors.push('Uninventoried art file: ' + path);
        }
      }
    }
  }
}
await collect(piecesRoot);
if (!pkg?.version || !pkg.integrity) errors.push('Missing locked Stockfish version/integrity in package-lock.json');
const binaries = [];
for (const name of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm', 'Stockfish-GPL-3.0.txt']) {
  const path = 'mobile/public/engine/' + name;
  try {
    const data = await readFile(at(path));
    const packageName = name === 'Stockfish-GPL-3.0.txt' ? 'Copying.txt' : 'bin/' + name;
    const npmFile = await readFile(at('node_modules/stockfish/' + packageName));
    if (sha256(data) !== sha256(npmFile)) errors.push('Bundled Stockfish file differs from exact npm-installed bytes: ' + name);
    binaries.push({path, sha256: sha256(data), sizeBytes:data.length});
  } catch { errors.push('Missing bundled or npm Stockfish engine file: ' + path + '; run npm ci and npm run build:mobile first'); }
}

let source = null;
try {
  const a = await readJson('compliance/stockfish-source-attestation.json');
  const archivePath = 'release-sources/stockfish-corresponding-source.tar.gz';
  const archive = await readFile(at(archivePath));
  const actualHash = sha256(archive);
  // Bind the manual attestation to a concrete formal rebuild record, not a
  // manually toggled boolean. Rebuilt and npm artifacts must match EXACTLY.
  let rebuild = null;
  try {
    rebuild = await readJson('artifacts/stockfish-source-rebuild-evidence.json');
    if (rebuild.status !== 'REPRODUCIBLE_EXACT' || rebuild.packageVersion !== pkg?.version || rebuild.sourceArchiveSha256 !== actualHash) {
      errors.push('Rebuild evidence does not match exact locked package/source archive');
    }
    for (const [filename, artifact] of [
      ['stockfish-19-lite-single.js', binaries.find(x => x.path.endsWith('/stockfish-19-lite-single.js'))],
      ['stockfish-19-lite-single.wasm', binaries.find(x => x.path.endsWith('/stockfish-19-lite-single.wasm'))],
    ]) {
      const matching = rebuild.comparisons?.filter(x => x.file === filename);
      if (!artifact || matching?.length !== 1 || !matching[0].exactMatch ||
          matching[0].npmSha256 !== artifact.sha256 ||
          matching[0].rebuiltSha256 !== artifact.sha256 ||
          matching[0].npmBytes !== artifact.sizeBytes ||
          matching[0].rebuiltBytes !== artifact.sizeBytes) {
        errors.push('Formal rebuild report does not prove exact packaged artifact: ' + filename);
      }
    }
    if (rebuild.postprocessWorkaround &&
        (rebuild.postprocessWorkaround.kind !== 'windows-symlink-alias-copy' ||
         rebuild.postprocessWorkaround.exactReplacementCount !== 1 ||
         rebuild.postprocessWorkaround.sourceArchiveUnmodified !== true)) {
      errors.push('Unsupported or undocumented Windows rebuild workaround');
    }
  } catch(e) {
    errors.push('Missing or unreadable formal Stockfish rebuild evidence: ' + e.message);
  }
  // Require a separate source-archive preflight. Its result is technical
  // evidence, not a legal approval and not an automatic attestation toggle.
  try {
    const review = await readJson('artifacts/stockfish-source-review.json');
    if (review.status !== 'TECHNICAL_PREFLIGHT_PASS_LEGAL_REVIEW_PENDING' ||
        review.sourceArchiveSha256 !== actualHash ||
        review.rebuild?.sourceArchiveSha256 !== actualHash ||
        review.rebuild?.reportedStatus !== 'REPRODUCIBLE_EXACT' ||
        !review.networkSha256PrefixMatchesName ||
        !Number.isInteger(review.sourceFiles) || review.sourceFiles < 10 ||
        review.issues?.length) {
      errors.push('Source preflight review missing, incomplete or inconsistent with archive');
    }
  } catch(e) {
    errors.push('Missing source archive review: run npm run android:source:review (' + e.message + ')');
  }
  // Verify the complete React/Android + Stockfish source package is tied to
  // this release before staging it alongside the engine source.
  try {
    const whole = await readJson('artifacts/chess-coach-complete-source-verification.json');
    const wholeBytes = await readFile(at('release-sources/chess-coach-complete-source-candidate.zip'));
    if (whole.status !== 'COMPLETE_SOURCE_TECHNICAL_PASS_LEGAL_PENDING' ||
        whole.legalApproval !== false || (whole.errors ?? []).length ||
        whole.archiveSha256 !== sha256(wholeBytes) ||
        whole.stockfishSourceSha256 !== actualHash) {
      errors.push('Whole-application source ZIP verification failed or is stale');
    }
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
    if (head.status !== 0 || whole.gitCommit !== head.stdout.trim()) {
      errors.push('Whole-application source ZIP does not match the current Git commit');
    }
    source = { ...(source ?? {}), completeArchiveSha256: sha256(wholeBytes), completeArchiveSizeBytes: wholeBytes.length };
  } catch(e) {
    errors.push('Missing verified whole-app source package: run npm run android:complete-source:verify (' + e.message + ')');
  }
  // A GitHub tag tarball alone omits the lite NNUE download. Require its exact
  // content-addressed bytes to be present inside the redistributed source.
  const tarList = spawnSync('tar', ['-tzf', at(archivePath)], { encoding: 'utf8' });
  if (tarList.error || tarList.status !== 0) {
    errors.push('Cannot inspect corresponding-source tarball (tar is required)');
  } else {
    const members = tarList.stdout.split(/\r?\n/).filter(Boolean);
    for (const suffix of ['/build.js', '/Copying.txt', '/scripts/net.sh', '/src/Makefile', '/src/evaluate.h', '/src/emscripten/wasm-makefile.mk', '/src/nn-61e7af4bb97d.nnue']) {
      if (!members.some(name => name.endsWith(suffix))) errors.push('Corresponding source archive missing: ' + suffix);
    }
    const netMember = members.find(name => name.endsWith('/src/nn-61e7af4bb97d.nnue'));
    if (netMember) {
      const net = spawnSync('tar', ['-xOf', at(archivePath), netMember], { encoding: null, maxBuffer: 64 * 1024 * 1024 });
      if (net.error || net.status !== 0 || sha256(net.stdout).slice(0, 12) !== '61e7af4bb97d') errors.push('Corresponding source NNUE bytes failed SHA-256 content-address verification');
      if (a.liteNetworkSha256 !== sha256(net.stdout) || a.liteNetworkName !== 'nn-61e7af4bb97d.nnue') errors.push('Attested lite NNUE name or hash does not match source archive');
    }
  }
  const requiredFields = ['packageVersion','sourceRevision','sourceUrl','buildInstructions','archiveSha256'];
  if (!reviewCandidate) requiredFields.push('reviewedBy', 'reviewDate');
  for (const field of requiredFields) {
    if (!hasValue(a[field])) errors.push('Incomplete Stockfish source attestation field: ' + field);
  }
  if (a.packageVersion !== pkg?.version) errors.push('Attested Stockfish version does not equal locked npm version');
  if (a.sourceRevision !== '0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6') errors.push('Attestation does not identify the pinned Stockfish.js 19.0.1 source commit');
  if (!/^[a-f0-9]{64}$/i.test(a.archiveSha256 ?? '') || a.archiveSha256 !== actualHash) errors.push('Corresponding source archive SHA-256 does not match attestation');
  if (Object.values(a).some((value) => typeof value === 'string' && /REPLACE_WITH|YYYY-MM-DD/.test(value))) errors.push('Stockfish attestation contains template placeholders');
  if (!reviewCandidate && !a.binaryMatchesSourceVerified) errors.push('Manual corresponding-source verification not attested');
  if (reviewCandidate && a.binaryMatchesSourceVerified !== false) errors.push('Review candidate requires a pending manual source attestation');
  source = { ...(source ?? {}), archivePath, sha256: actualHash, sizeBytes: archive.length, attestation: a };
} catch(e) { errors.push('Missing/unreadable source archive or compliance/stockfish-source-attestation.json: ' + e.message); }

if (errors.length) {
  console.error('ANDROID THIRD-PARTY RELEASE GATE FAILED:');
  for (const error of errors) console.error(' - ' + error);
  process.exitCode = 1;
} else {
  const sourceTarget = at('mobile/public/engine/source/stockfish-corresponding-source.tar.gz');
  await mkdir(at('mobile/public/engine/source'), { recursive: true });
  await copyFile(at(source.archivePath), sourceTarget);
  await copyFile(at('release-sources/chess-coach-complete-source-candidate.zip'), at('mobile/public/engine/source/chess-coach-complete-source.zip'));
  const manifest = {
    schemaVersion: 1,
    releaseStatus: reviewCandidate ? 'REVIEW_CANDIDATE_ONLY' : 'LEGAL_ATTESTATION_RECORDED',
    legalApproval: !reviewCandidate,
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
    completeApplicationSource: {
      path: 'engine/source/chess-coach-complete-source.zip',
      sha256: source.completeArchiveSha256,
      sizeBytes: source.completeArchiveSizeBytes,
    },
    assets: found,
    artworkNoticeFiles: noticeFiles
  };
  await writeFile(at('mobile/public/engine/source/compliance-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(reviewCandidate
    ? 'Review-only source candidate staged. Legal approval is pending; do not upload this AAB to Play.'
    : 'Android license release gate passed. Source archive and manifest staged for mobile build.');
  console.log('Artwork attribution/license documents indexed: ' + noticeFiles.length);
  console.log('Run npm run android:sync, then verify the archive and manifest inside the signed AAB.');
}
