import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";

const read = name => fs.readFileSync(new URL("../test/" + name, import.meta.url), "utf8");
const app = read("app.js");
const html = read("index.html");
const manifest = JSON.parse(read("build-info.json"));
const sha = s => createHash("sha1").update("blob " + Buffer.byteLength(s) + "\0").update(s).digest("hex");
const begin = app.indexOf("function Ky(");
const finish = app.indexOf("}function eb(",begin);
const details = app.slice(begin,finish);
const enc = value => [...value].map(ch => ch.charCodeAt(0)>127?"\\u"+ch.charCodeAt(0).toString(16).toUpperCase().padStart(4,"0"):ch).join("");

test("document workspace only contains application document and approval",()=>{
  assert.ok(begin>=0 && finish>begin,"transport application component not found");
  assert.match(details,/renderCompactDocument/);
  assert.match(details,/\/api\/transport-applications/);
  assert.ok(details.includes(enc("Согласовать заявку и ставку")),"approval action missing");
  assert.doesNotMatch(details,/\br\(tb,|\br\(nb,|\br\(rb,/,"execution/documents/claims components must not be mounted in document card");
  assert.doesNotMatch(details,/href:\s*"#approved-shipments"/,"extra execution navigation must remain in sidebar only");
  assert.ok(!details.includes(enc("История этапов и решений")),"execution history must not be rendered here");
});

test("standalone execution workspace and sidebar remain intact",()=>{
  assert.ok(app.includes('id:"transport-applications"'));
  assert.ok(app.includes('id:"approved-shipments"'));
  assert.match(read("task2-panel-sidebar-only-20261107.js"),/if\(state\.tab==="stages"\)/);
});

test("published index references the exact staging application blob",()=>{
  assert.equal(manifest.environment,"staging");
  assert.equal(manifest.projectRef,"ibclzdkxiozbzmniiygv");
  assert.equal(manifest.servedAppBlobSha,sha(app));
  assert.ok(html.includes("app.js?v="+sha(app).slice(0,12)));
  assert.equal(manifest.issue28.documentOnly,true);
  assert.equal(manifest.issue28.productionChanged,false);
});
