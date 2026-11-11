import {runtimeAssetUrl} from './helpers/runtime-assets.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const js=readFileSync("test/owner-registers-20261111.js","utf8");
const css=readFileSync("test/owner-registers-20261111.css","utf8");
const html=readFileSync("test/index.html","utf8");
test("owner registers reuse actual secure sources and preserve existing React routes",()=>{
 execFileSync(process.execPath,["--check","test/owner-registers-20261111.js"]);
 for(const id of ["updates","remarks","developments","cooperation","process"])assert.match(js,new RegExp('\\b'+id+'\\b'),id);
 assert.match(js,/engineering-registers/);assert.match(js,/portal-feedback/);
 assert.match(js,/ow-cooperation-screen/);assert.match(js,/ow-process-editor/);
 assert.doesNotMatch(js,/frame\.src|process-frame/);
 assert.match(js,/OW-01\.30\.47 v/);assert.match(js,/expectedSha/);
 for(const key of ['version','role','status','from','to'])assert.ok(js.includes("'"+key+"'"));

});
test("HTML includes safe local frame CSP and new files",()=>{
 assert.match(html,/frame-src 'self' https:\/\/yandex\.ru/);
 assert.ok(html.includes(runtimeAssetUrl('owner-registers-20261111.js')));
 assert.ok(html.includes(runtimeAssetUrl('owner-registers-20261111.css')));
 assert.ok(readFileSync("test/process-map.html","utf8").includes("20261111-logic-8"));
 assert.match(css,/ow-editor-grid/);assert.match(css,/max-width:900px/);
});
