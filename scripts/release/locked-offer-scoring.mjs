// #93 / #94: independent exact-pair score source guard. No deployment or credentials.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,readLock,requireCheck,validateLock,stagingUrl} from './locked-release.mjs';

export function verifyScoringBytes(root,staging,api) {
  requireCheck(root.length>0&&staging.length>0&&api.length>0,'OFFER_SCORING_SOURCE_MISSING');
  requireCheck(root.equals(staging),'OFFER_SCORING_FRONTEND_STAGING_MISMATCH');
  requireCheck(root.equals(api),'OFFER_SCORING_FRONTEND_API_MISMATCH');
  return digest(root);
}

export function verifyScoringPair(frontend,backend,lock) {
  validateLock(lock);
  const read=(dir,sha,path)=>{
    const tracked=execFileSync('git',['-C',dir,'show',sha+':'+path],{maxBuffer:2*1024*1024});
    const bytes=readFileSync(join(dir,path));
    requireCheck(bytes.equals(tracked),'OFFER_SCORING_CHECKOUT_DRIFT:'+path);
    return bytes;
  };
  return verifyScoringBytes(read(frontend,lock.frontendSha,'offer-scoring.mjs'),
    read(frontend,lock.frontendSha,'test/offer-scoring.mjs'),
    read(backend,lock.backendSha,'src/transport-application/offer-scoring.mjs'));
}
export async function verifyServedScoring(frontend,backend,lock,fetcher=fetch) {
  const sha=verifyScoringPair(frontend,backend,lock);
  const url=new URL('offer-scoring.mjs',stagingUrl);
  url.searchParams.set('locked-scoring',lock.frontendSha);
  const r=await fetcher(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
  requireCheck(r.ok&&digest(Buffer.from(await r.arrayBuffer()))===sha,'OFFER_SCORING_STAGING_SERVED_MISMATCH');
  return sha;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [frontend,backend]=process.argv.slice(2);
  console.log('OFFER_SCORING_EXACT_PAIR_PASS',verifyScoringPair(frontend,backend,readLock()));
}
