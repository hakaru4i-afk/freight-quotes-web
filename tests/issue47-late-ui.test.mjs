import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const js=readFileSync("test/app.js","utf8");
const panel=readFileSync("test/late-bid-staging.js","utf8");
const html=readFileSync("test/index.html","utf8");
const info=JSON.parse(readFileSync("test/build-info.json","utf8"));
test("assigned carrier late offer has enabled submit and starts the verified preparation before POST",()=>{
 assert.match(js,/disabled:V\\?\\.carrierPolicy\\?\\.blocked\\|\\|x\\|\\|_\\|\\|!u\\|\\|\\(V\\?\\.role!=="carrier"&&\\(!i\\|\\|!K\\)\\)/);
 assert.doesNotMatch(js,/disabled:[^,]*re&&!window\\.freightLateDraftActive/);
 assert.ok(js.includes("freightPrepareLateOnSubmit(h,source.round_id)"));
 assert.ok(js.includes('action:"start",order,notificationId:assigned.notification_id'));
 assert.ok(js.includes('state.role!=="carrier"'));
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
 assert.equal(info.task2.backendFunction,"freight-api");
 assert.equal(info.task2.backendVersion,info.carrierOutcomeFix.backendVersion);
 assert.equal(info.task2.lastObservedBackendVersion,info.task2.backendVersion);
 assert.equal(info.task2.backendDeploymentStatus,`SHARED_STAGING_API_V${info.task2.backendVersion}_ACTIVE; FULL_ACCEPTANCE_PENDING`);
 assert.match(js,/functions\/v1\/freight-api"/);
 assert.doesNotMatch(js,/functions\/v1\/freight-api-qa-issue47qa/);
 assert.equal(info.task2Complete,false);
 assert.ok(html.includes("app.js?v="+info.servedAppBlobSha.slice(0,12)));
 assert.ok(html.includes(info.lateBidUiScript+"?v="+info.lateBidUiSha.slice(0,12)));
 assert.ok(!readFileSync("index.html","utf8").includes("late-bid-staging.js"));
});

test("annulled/hidden requests do not offer late rate preparation in carrier view",()=>{
 assert.match(panel,/String\(i\.workflow_status\|\|""\)\.toLowerCase\(\)!=="annulled"/);
 assert.match(panel,/Подготовить позднюю ставку/);
 assert.doesNotMatch(panel,/>Взять в работу<\/a>/);
 assert.equal(info.task2.backendVersion,63);
 assert.equal(info.stagingAnnulledLateBidFix.order,"76");
 assert.equal(info.stagingAnnulledLateBidFix.productionChanged,false);
});

test("owner offer review: completed selection disables stale controls for every carrier in that round",()=>{
 const app=readFileSync("test/app.js","utf8");
 assert.match(app,/selection:F\.selections\?\.find\(v=>v\.round_id===C\.round_id\)/);
 assert.match(app,/\(c&&!h\)\?r\("button"/);
 assert.match(app,/Не выбран · отбор завершён/);
 assert.match(app,/closedRounds:F\.selections\?\.map\(v=>v\.round_id\)/);
 assert.match(app,/!closed\.includes\(w\.round_id\)/);
 assert.match(app,/!F\.selections\?\.some\(v=>v\.round_id===C\.round_id\)&&o\("div"/);
 assert.match(app,/Не выбран · архив/);
 assert.ok(!app.includes("Новый выбор заменит предыдущий вариант.") || app.includes("Отбор завершён"));
 assert.equal(info.ownerOfferReviewFix.productionChanged,false);
});
