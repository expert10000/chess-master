#!/usr/bin/env node
// Rebuild Stockfish.js 19.0.1 lite-single from the prepared source archive.
// Exact JS/WASM SHA-256 comparison against the installed npm distribution.
// Requires Emscripten 6.0.9 (activated) and network for pinned Terser 5.51.2.
// Does not authorize distribution of a combined GPL application.
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd(), sha256 = data => createHash('sha256').update(data).digest('hex');
const archive = resolve(root, 'release-sources/stockfish-corresponding-source.tar.gz');
const locked = JSON.parse(await readFile(resolve(root, 'package-lock.json'),'utf8')).packages?.['node_modules/stockfish']?.version;
if (locked !== '19.0.1') throw Error('Only stockfish@19.0.1 has been audited for this comparison.');
const expectedNet = 'nn-61e7af4bb97d.nnue';
function command(exe,args,cwd) {
  const result = spawnSync(exe,args,{cwd,encoding:'utf8',stdio:'inherit',shell:process.platform==='win32'});
  if (result.error || result.status !== 0) throw Error(exe + ' failed (exit '+result.status+'): '+args.join(' ') + (result.error?.message ?? ''));
}
const emcc = spawnSync('emcc',['--version'],{encoding:'utf8',shell:process.platform==='win32'});
if (emcc.error || emcc.status !== 0 || !(emcc.stdout + emcc.stderr).includes('6.0.9')) {
  throw Error('Emscripten 6.0.9 must be installed and activated before reproducible rebuild verification.');
}
const workspace = await mkdtemp(join(tmpdir(), 'stockfish-rebuild-'));
const sourceParent = join(workspace,'source');
await mkdir(sourceParent);
if (process.platform === 'win32') {
  command('py',['-3','scripts/stockfish-source-archive.py','extract',archive,sourceParent],root);
} else {
  command('python3',['scripts/stockfish-source-archive.py','extract',archive,sourceParent],root);
}
const roots = (await readdir(sourceParent,{withFileTypes:true})).filter(x=>x.isDirectory());
if (roots.length!==1) throw Error('Unexpected source archive layout');
const tree = join(sourceParent,roots[0].name);
const net = await readFile(join(tree,'src',expectedNet));
if (sha256(net).slice(0,12)!=='61e7af4bb97d') throw Error('Source archive lite NNUE does not match its SHA-256 name.');
console.log('Building from verified source candidate with Emscripten 6.0.9 at:',tree);
command(process.platform==='win32'?'npm.cmd':'npm',['install','--ignore-scripts','--no-audit','--no-fund'],tree);
command(process.execPath,['build.js','--single-threaded','--lite','--force'],tree);
const files = ['stockfish-19-lite-single.js','stockfish-19-lite-single.wasm'];
const comparisons = [];
for(const file of files){
  const actual=await readFile(join(tree,'src',file));
  const shipped=await readFile(join(root,'node_modules','stockfish','bin',file));
  comparisons.push({file,rebuiltSha256:sha256(actual),npmSha256:sha256(shipped),rebuiltBytes:actual.length,npmBytes:shipped.length,exactMatch:actual.equals(shipped)});
}
const sourceBytes=await readFile(archive);
const evidence={
  status:comparisons.every(x=>x.exactMatch)?'REPRODUCIBLE_EXACT':'MISMATCH',
  packageVersion:locked,
  sourceArchiveSha256:sha256(sourceBytes),
  nnueName:expectedNet,
  nnueSha256:sha256(net),
  emscriptenVersion:(emcc.stdout+emcc.stderr).split('\n')[0],
  command:'node build.js --single-threaded --lite --force',
  comparisons,
  worktree:tree,
};
await mkdir(resolve(root,'artifacts'),{recursive:true});
const output=resolve(root,'artifacts/stockfish-source-rebuild-evidence.json');
await writeFile(output,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,comparisons,output},null,2));
if(evidence.status!=='REPRODUCIBLE_EXACT'){
  console.error('BLOCKED: source-to-binary hashes differ. Inspect toolchain/build differences before attesting.');
  process.exitCode=1;
}else{
  console.log('Exact JS/WASM reproduction observed. Review source completeness and GPL obligations separately before signing attestation.');
}
