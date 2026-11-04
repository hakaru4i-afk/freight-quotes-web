import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const staging = fs.readFileSync("test/app.js", "utf8");
const production = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("test/index.html", "utf8");
const info = JSON.parse(fs.readFileSync("test/build-info.json", "utf8"));
const start = staging.indexOf("function B0({bid:i,onSaved:c,role:h=");
const stop = staging.indexOf("Se();var ee=", start);
const editor = staging.slice(start, stop);

test("Owner bid editor carries preserved route when origin/destination hide route input", () => {
  assert.ok(start > 0 && stop > start, "bid editor found in staging source");
  assert.ok(editor.includes('b!=="route"'), "origin editor deliberately hides route input");
  assert.ok(
    editor.includes('body:JSON.stringify({...A,route:A.route??i.route??"",id:i.id,expected:i})'),
    "PATCH must include route from the existing bid when the form omits it"
  );
  assert.ok(editor.includes('method:"PATCH"'), "edits use the PATCH endpoint");
  assert.ok(editor.includes('fetch("/api/bids"'), "editing targets canonical bids endpoint");
});

test("only staging editor is changed and browser cache bust points at the pinned blob", () => {
  assert.ok(!production.includes('body:JSON.stringify({...A,route:A.route??i.route??"",id:i.id,expected:i})'),
    "production bundle not modified by the hotfix");
  assert.equal(info.environment, "staging");
  assert.equal(info.hotfix?.issue, 47);
  assert.ok(html.includes("./app.js?v=" + info.servedAppBlobSha.slice(0, 12)),
    "staging index must reference patched app asset");
});
