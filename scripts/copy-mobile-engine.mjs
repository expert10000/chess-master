import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('node_modules', 'stockfish');
const target = resolve('mobile', 'public', 'engine');
await mkdir(target, { recursive: true });
for (const name of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  await copyFile(resolve(source, 'bin', name), resolve(target, name));
}
await copyFile(resolve(source, 'Copying.txt'), resolve(target, 'Stockfish-GPL-3.0.txt'));
