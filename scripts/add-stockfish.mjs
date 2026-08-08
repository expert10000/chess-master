import { access, chmod, copyFile, mkdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const input = process.argv.slice(2).join(' ').trim();
if (!input) {
  console.error('Usage: npm run stockfish:add -- "C:\\path\\to\\stockfish.exe"');
  process.exit(1);
}

const source = resolve(input.replace(/^"|"$/g, ''));
try {
  await access(source);
} catch {
  console.error(`Stockfish executable not found: ${source}`);
  process.exit(1);
}

const outputName = process.platform === 'win32' ? 'stockfish.exe' : 'stockfish';
const outputDir = resolve('resources', 'stockfish');
const output = resolve(outputDir, outputName);

await mkdir(outputDir, { recursive: true });
await copyFile(source, output);
if (process.platform !== 'win32') await chmod(output, 0o755);

console.log(`Copied ${basename(source)} to ${output}`);
console.log('Run: npm run stockfish:check');
