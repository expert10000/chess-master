// Scope MSYS2's POSIX tools to Stockfish's verification subprocess only.
// Do not rewrite the user's machine PATH or override EMSDK/EM_CONFIG.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function findBin() {
  const candidates = [
    process.env.STOCKFISH_MSYS_BIN,
    process.env.MSYS2_ROOT ? join(process.env.MSYS2_ROOT, 'usr', 'bin') : null,
    'C:\\msys64\\usr\\bin',
    process.env.USERPROFILE ? join(process.env.USERPROFILE, 'tools', 'msys64', 'usr', 'bin') : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const bin = resolve(candidate);
    if (existsSync(join(bin, 'make.exe')) && existsSync(join(bin, 'sh.exe'))) return bin;
  }
  return null;
}

export function verificationEnvironment() {
  const env = {...process.env};
  let msysBin = null;
  if (process.platform === 'win32') {
    msysBin = findBin();
    if (msysBin) env.Path = env.PATH = msysBin + ';' + (env.PATH ?? env.Path ?? '');
  }
  return {env, msysBin};
}

function probe(command, args, env) {
  return spawnSync(command, args, {
    encoding:'utf8', env, shell:false, windowsHide:true, timeout:20000
  });
}

export function verifyMakeTools() {
  const {env, msysBin} = verificationEnvironment();
  const make = probe(process.platform === 'win32' && msysBin ? join(msysBin,'make.exe') : 'make', ['--version'], env);
  const sh = probe(process.platform === 'win32' && msysBin ? join(msysBin,'sh.exe') : 'sh', ['-c', 'printf "shell-ready\\n"'], env);
  const grep = probe(process.platform === 'win32' && msysBin ? join(msysBin,'grep.exe') : 'grep', ['--version'], env);
  if (make.error || make.status !== 0 || !/GNU Make/.test(make.stdout ?? '') ||
      sh.error || sh.status !== 0 || grep.error || grep.status !== 0) {
    const details = [
      'Stockfish source rebuild requires GNU Make plus POSIX sh/grep.',
      'Install MSYS2 (https://www.msys2.org/) and, in an MSYS2 MSYS terminal, run:',
      '  pacman -Syu',
      '  pacman -S --needed make bash coreutils grep sed gawk',
      'Restart the MSYS2 terminal after a core update if requested.',
      'Use the activated emsdk cmd shell for npm run android:source:verify.',
      'Default location: C:\\msys64\\usr\\bin; for another install use:',
      '  set STOCKFISH_MSYS_BIN=D:\\path\\to\\msys64\\usr\\bin',
      'No GNU Make toolchain verified; do not attest binary reproducibility.',
    ].join('\n');
    throw Error(details);
  }
  console.log('GNU Make:', (make.stdout ?? '').split('\n')[0]);
  console.log('MSYS2 tools:', msysBin ?? 'resolved from PATH');
  console.log('POSIX shell: PASS; grep: PASS');
  return env;
}

if (process.argv[1]?.replaceAll('\\','/').endsWith('/stockfish-windows-tools.mjs')) {
  try { verifyMakeTools(); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
