import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const executable = resolve(
  'resources',
  'stockfish',
  process.platform === 'win32' ? 'stockfish.exe' : 'stockfish',
);

try {
  await access(executable);
} catch {
  console.error(`No engine found at ${executable}`);
  console.error('Use: npm run stockfish:add -- "C:\\path\\to\\stockfish.exe"');
  process.exit(1);
}

const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
let output = '';
const timer = setTimeout(() => {
  child.kill();
  console.error('Stockfish did not answer UCI within 8 seconds.');
  process.exit(1);
}, 8_000);

child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  output += chunk;
  if (output.includes('uciok')) {
    clearTimeout(timer);
    const name = output.split(/\r?\n/).find((line) => line.startsWith('id name '));
    console.log(name ?? 'Stockfish UCI engine detected');
    child.stdin.write('quit\n');
  }
});
child.stderr.on('data', (chunk) => process.stderr.write(chunk));
child.on('exit', (code) => process.exit(code === 0 ? 0 : 1));
child.stdin.write('uci\n');
