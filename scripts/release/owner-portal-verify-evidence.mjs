// The source and production build are verified separately by the release workflow.
// Reuse fresh main browser E2E and fresh encrypted backup evidence without SHA equality.
import {execFileSync} from 'node:child_process';
const env={...process.env};
if(!env.GITHUB_WEB_TOKEN||!env.GITHUB_BACKEND_TOKEN)throw Error('RELEASE_GITHUB_TOKENS_MISSING');
execFileSync(process.execPath,['scripts/release/owner-portal-verify-evidence-frontend.mjs'],{env,stdio:'inherit',timeout:90000});
execFileSync(process.execPath,['backend/scripts/release/owner-portal-verify-evidence-backend.mjs'],{env,stdio:'inherit',timeout:90000});
console.log('PASS_MAIN_E2E_AND_RECENT_PRODUCTION_BACKUP');
