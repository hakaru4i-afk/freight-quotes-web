import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const js=readFileSync("test/owner-registers-20261111.js","utf8");
const css=readFileSync("test/owner-registers-20261111.css","utf8");
const html=readFileSync("test/index.html","utf8");
test("owner registers reuse actual secure sources and preserve existing React routes",()=>{
 execFileSync(process.execPath,["--check","test/owner-registers-20261111.js"]);
 for(const id of ["updates","remarks","developments","cooperation","process"])assert.ok(js.includes('"'+id+'"'),id);
 for(const id of ["UPDATES.md","REMARKS.md","DEVELOPMENT.md"])assert.ok(js.includes(id),id);
 assert.match(js,/portal-feedback/);
 assert.match(js,/#lw-owner-inquiries/);
 assert.match(js,/frame\.src="\.\/process-map\.html"/);
 assert.match(js,/OW-01\.30\.46 v/);
});
test("HTML includes safe local frame CSP and new files",()=>{
 assert.match(html,/frame-src 'self' https:\/\/yandex\.ru/);
 assert.match(html,/owner-registers-20261111\.js\?v=ow013046/);
 assert.match(html,/owner-registers-20261111\.css\?v=ow013046/);
 assert.ok(readFileSync("test/process-map.html","utf8").includes("20261111-logic-8"));
 assert.match(css,/data-ow-register-view="process"/);
});
