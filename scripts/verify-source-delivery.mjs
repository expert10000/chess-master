#!/usr/bin/env node
// Validate candidate public GPL source URL *without publishing anything*.
// Usage: node scripts/verify-source-delivery.mjs compliance/source-delivery-plan.local.json
// Plan JSON stays local, ignored. Requires an actual public HTTPS endpoint.
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=process.cwd();
const path=process.argv[2];
if (!path) throw Error('Provide path to explicit local source-delivery plan. No URL will be invented.');
const plan=JSON.parse(await readFile(resolve(root,path),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const requireUrl=(candidate,label)=>{
  const u=new URL(candidate);
  if(u.protocol!=='https:'||u.username||u.password||
     /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|::1)$/i.test(u.hostname)||
     u.hostname.endsWith('.local')) throw Error(label+' must be publicly reachable HTTPS, without credentials');
  return u;
};
const failures=[];
const baseline='1d3d85d6f3e889beda0a97c4f59e29f51902f9c2';
if(plan.sourceCommit!==baseline)failures.push('Plan does not target the qualified release commit');
const bytes=await readFile(resolve(root,'release-sources/chess-coach-complete-source-candidate.zip'));
const actualHash=sha(bytes);
if(plan.sourceArchiveSha256!==actualHash)failures.push('Plan digest differs from the local complete-source ZIP');
if(!Number.isInteger(plan.androidVersionCode)||plan.androidVersionCode<1)failures.push('Missing release versionCode');
if(typeof plan.androidVersionName!=='string'||!plan.androidVersionName.trim())failures.push('Missing release versionName');
if(!plan.storeListingSourceInstructions || !plan.storeListingSourceInstructions.includes(plan.sourceUrl||''))
  failures.push('Play listing disclosure text must contain the exact source URL');
let u;
try {u=requireUrl(plan.sourceUrl,'Source archive URL');}catch(e){failures.push(e.message);}
let remote=null;
if(u){
 try{
   const res=await fetch(u,{redirect:'follow',signal:AbortSignal.timeout(120000),headers:{'Accept':'application/zip'}});
   if(!res.ok) throw Error('HTTP '+res.status);
   requireUrl(res.url,'Final redirected source URL');
   const remoteBytes=Buffer.from(await res.arrayBuffer());
   const hash=sha(remoteBytes);
   remote={finalUrl:res.url,httpStatus:res.status,sha256:hash,sizeBytes:remoteBytes.length};
   if(hash!==actualHash)failures.push('Published source archive checksum differs from local qualified candidate');
 }catch(e){failures.push('Source download failed: '+e.message);}
}
const report={status:failures.length?'BLOCKED':'SOURCE_DELIVERY_TECHNICAL_PASS_LEGAL_PENDING',qualifiedCommit:baseline,
    localArchiveSha256:actualHash,remote,versionCode:plan.androidVersionCode,
    versionName:plan.androidVersionName,issues:failures,legalApproval:false,
    authorizedForPlayUpload:false};
await mkdir(resolve(root,'artifacts'),{recursive:true});
await writeFile(resolve(root,'artifacts/chess-coach-source-delivery-verification.json'),
    JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
