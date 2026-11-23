// Release evidence must match the exact pinned source pair and include a real restore.
// A successful encrypted capture alone is not evidence that DB + Storage can be restored.
import {execFileSync} from 'node:child_process';
const env={...process.env};
if(!env.GITHUB_WEB_TOKEN||!env.GITHUB_BACKEND_TOKEN)throw Error('RELEASE_GITHUB_TOKENS_MISSING');
if(!/^[a-f0-9]{40}$/.test(env.FRONTEND_SHA||'')||!/^[a-f0-9]{40}$/.test(env.BACKEND_SHA||''))throw Error('RELEASE_EXACT_SOURCE_PAIR_REQUIRED');
const actualFrontend=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(actualFrontend!==env.FRONTEND_SHA)throw Error('RELEASE_FRONTEND_CHECKOUT_SHA_MISMATCH');
const actualBackend=execFileSync('git',['-C','backend','rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(actualBackend!==env.BACKEND_SHA)throw Error('RELEASE_BACKEND_CHECKOUT_SHA_MISMATCH');
// Fail before any remote evidence calls when restoration is not independently proven.
// No receipt validator is installed yet; never accept an env flag or a backup capture as proof.
throw Error('RELEASE_ISOLATED_DB_STORAGE_RESTORE_RECEIPT_REQUIRED');
