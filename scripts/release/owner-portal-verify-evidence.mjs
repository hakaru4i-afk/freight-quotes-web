// Release evidence must match the exact pinned source pair and include a real restore.
// A successful encrypted capture alone is not evidence that DB + Storage can be restored.
import {execFileSync} from 'node:child_process';
const env={...process.env};
if(!env.GITHUB_WEB_TOKEN||!env.GITHUB_BACKEND_TOKEN)throw Error('RELEASE_GITHUB_TOKENS_MISSING');
if(!/^[a-f0-9]{40}$/.test(env.FRONTEND_SHA||'')||!/^[a-f0-9]{40}$/.test(env.BACKEND_SHA||''))throw Error('RELEASE_EXACT_SOURCE_PAIR_REQUIRED');
const actualBackend=execFileSync('git',['-C','backend','rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(actualBackend!==env.BACKEND_SHA)throw Error('RELEASE_BACKEND_CHECKOUT_SHA_MISMATCH');
execFileSync(process.execPath,['scripts/release/owner-portal-verify-evidence-frontend.mjs'],{env,stdio:'inherit',timeout:90000});
execFileSync(process.execPath,['backend/scripts/release/owner-portal-verify-evidence-backend.mjs'],{env,stdio:'inherit',timeout:90000});
// Backend's current verifier proves encrypted capture/readback only, not isolated restoration.
// Keep production blocked until a separate machine-verifiable DB+Storage restore receipt
// is bound to this exact release pair; do not convert a backup-only PASS into restore PASS.
throw Error('RELEASE_ISOLATED_DB_STORAGE_RESTORE_RECEIPT_REQUIRED');
