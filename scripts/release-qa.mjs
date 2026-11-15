import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const exists = (relative) => fs.existsSync(path.join(root, relative));
const errors = [];

const pkg = readJson('package.json');
if (!/^1\./.test(pkg.version)) errors.push(`package.json must be on the stable 1.x line, found ${pkg.version}`);
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
  'docs/PERSISTENT_GAME_LIBRARY.md',
  'docs/GAME_ANALYTICS_V1_0_3.md',
  'docs/REVIEW_LAYOUT_V1_0_3_3.md',
  'docs/GAME_LIBRARY_ORGANIZATION_V1_0_4.md',
  'docs/ANALYTICS_DRILLDOWN_V1_0_5.md',
  'docs/RECOMMENDATION_OUTCOMES_V1_0_7.md',
  'docs/INTERVENTION_HISTORY_ANALYTICS_V1_0_8.md',
  'docs/FAST_PLAY_V1_0_8.md',
  'docs/RELEASE_QA_V1.md',
  'src/components/PersonalCoachDashboard.tsx',
  'src/components/DataManagementPanel.tsx',
  'src/components/GameLibraryPanel.tsx',
  'src/components/BoardThemeControl.tsx',
  'src/components/ReviewLayoutControl.tsx',
  'src/components/GameLevelAnalyticsPanel.tsx',
  'src/components/PersonalCoachRecommendationsPanel.tsx',
  'src/components/RecommendationOutcomePanel.tsx',
  'src/components/InterventionHistoryAnalyticsPanel.tsx',
  'src/lib/personalCoachRecommendations.ts',
  'src/lib/recommendationOutcomes.ts',
  'src/lib/interventionHistoryAnalytics.ts',
  'tests/personalCoachRecommendations.test.ts',
  'tests/recommendationOutcomes.test.ts',
  'tests/interventionHistoryAnalytics.test.ts',
  'src/lib/gameLibrary.ts',
  'src/lib/gameAnalytics.ts',
  'tests/gameLibrary.test.ts',
  'tests/gameAnalytics.test.ts',
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
  `createCoachBackup(window.localStorage, '${pkg.version}'`,
  'restoreCoachBackup(window.localStorage',
  'onUpdateMetadata={updateSavedGameMetadata}',
  'onOpenMove={(entry, ply) => void loadGameFromLibrary(entry, ply)}',
  'Fast — play first',
  'UI_PLAY_PACE_STORAGE_KEY',
  '<RecommendationOutcomePanel',
  '<InterventionHistoryAnalyticsPanel',
]) {
  if (!app.includes(marker)) errors.push(`App integration marker missing: ${marker}`);
}

if (errors.length) {
  console.error('\nStockfish Coach stable-line static release QA FAILED:\n');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('Stockfish Coach stable-line static release QA passed.');
console.log('Reminder: release:qa also runs typecheck, Vitest, and production build before this static gate.');
