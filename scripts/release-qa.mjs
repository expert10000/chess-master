import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const exists = (relative) => fs.existsSync(path.join(root, relative));
const errors = [];

const pkg = readJson('package.json');
if (pkg.version !== '1.0.0') errors.push(`package.json version must be 1.0.0, found ${pkg.version}`);
if (!pkg.scripts?.typecheck) errors.push('typecheck script is missing');
if (!pkg.scripts?.test) errors.push('test script is missing');
if (!pkg.scripts?.build) errors.push('build script is missing');
if (!pkg.scripts?.['release:qa']) errors.push('release:qa script is missing');

const required = [
  'README.md',
  'CHANGELOG.md',
  'VERSIONS.md',
  'docs/STABLE_RELEASE_V1.md',
  'docs/DATA_BACKUP.md',
  'docs/RELEASE_QA_V1.md',
  'src/components/PersonalCoachDashboard.tsx',
  'src/components/DataManagementPanel.tsx',
  'src/lib/dataBackup.ts',
  'tests/dataBackup.test.ts',
];

for (const relative of required) {
  if (!exists(relative)) errors.push(`required release file missing: ${relative}`);
}

const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
for (const marker of [
  '<PersonalCoachDashboard',
  '<DataManagementPanel',
  "createCoachBackup(window.localStorage, '1.0.0'",
  'restoreCoachBackup(window.localStorage',
]) {
  if (!app.includes(marker)) errors.push(`App integration marker missing: ${marker}`);
}

if (errors.length) {
  console.error('\nStockfish Coach v1.0.0 static release QA FAILED:\n');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('Stockfish Coach v1.0.0 static release QA passed.');
console.log('Reminder: release:qa also runs typecheck, Vitest, and production build before this static gate.');
