import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const js=readFileSync("test/app.js","utf8");
const panel=readFileSync("test/late-bid-staging.js","utf8");
const html=readFileSync("test/index.html","utf8");
const info=JSON.parse(readFileSync("test/build-info.json","utf8"));
test("late offer submit blocked unless verified active preparation",()=>{
 assert.match(js,/disabled:V\?\.carrierPolicy\?\.blocked\|\|x\|\|_\|\|!u\|\|!i\|\|!K\|\|\(re&&!window\.freightLateDraftActive\)/);
 assert.match(js,/children:_\?"\\u041E\\u0442\\u043F\\u0440\\u0430\\u0432\\u043B\\u044F\\u0435\\u043C\\u2026":re&&!window\.freightLateDraftActive\?/);
});
test("carrier starts and cancels late preparation through authenticated canonical API",()=>{
 assert.match(panel,/fetch\("\/api\/late-bid-drafts"/);
 assert.match(panel,/action==="cancel"/);
 assert.match(panel,/action==="resolve"/);
 assert.match(panel,/window\.freightLateDraftActive=!!active/);
 assert.match(panel,/data-notification/);
});
test("owner can see preparation and client mirrors server winner guard",()=>{
 assert.match(panel,/lockWinnerButtons\(active\)/);
 assert.match(panel,/ev\.stopImmediatePropagation\(\)/);
 assert.match(panel,/Причина ручного снятия/);
});
test("staging build and source SHA are version matched",()=>{
 assert.equal(info.environment,"staging");
 assert.equal(info.projectRef,"ibclzdkxiozbzmniiygv");
 assert.equal(info.task2.backendVersion,47);
 assert.equal(info.task2Complete,false);
 assert.ok(html.includes("app.js?v="+info.servedAppBlobSha.slice(0,12)));
 assert.ok(html.includes("late-bid-staging.js?v="+info.lateBidUiSha.slice(0,12)));
 assert.ok(!readFileSync("index.html","utf8").includes("late-bid-staging.js"));
});
