import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const s=readFileSync("test/role-help-20261111.js","utf8");
const h=readFileSync("test/index.html","utf8");
test("SH-01.30.46 v FAQ for all staff roles without privilege changes",()=>{
 execFileSync(process.execPath,["--check","test/role-help-20261111.js"]);
 for(const x of ["supplier","designer","content","purchasing","certification"])assert.ok(s.includes(x+":{"),x);
 for(const x of ["ru:","en:","zh:","FAQ и инструкции по кабинетам","SH-01.30.46 v"])assert.ok(s.includes(x),x);
 assert.match(h,/role-help-20261111\.js/);assert.match(h,/role-help-20261111\.css/);
 assert.ok(!/fetch\s*\(|\/api\/|localStorage|sessionStorage/.test(s),"FAQ must not read private data or modify access");
});
