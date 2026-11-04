import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app=readFileSync("test/app.js","utf8");
const page=readFileSync("test/index.html","utf8");
const release=JSON.parse(readFileSync("test/build-info.json","utf8"));
const start=app.indexOf('A=[["carrier"');
const end=app.indexOf('},R=',start);
const controls=app.slice(start,end);

test("Owner has seven separately named preview roles",()=>{
  assert.ok(start>=0&&end>start);
  for(const name of ["Перевозчик","ВЭД","Поставщик","Дизайнер","Контент-менеджер","Менеджер по закупкам","Специалист по сертификации"])
    assert.ok(controls.includes(name),"Missing agreed role "+name);
  assert.ok(!controls.includes("Дизайн и контент"),"Designer must not be combined with Content manager");
});

test("Unapproved roles have no invented work menu",()=>{
  assert.ok(app.includes("Меню и бизнес-процессы этого кабинета пока не согласованы"));
  assert.ok(app.includes('y&&!["content","purchasing","certification"].includes(w?.role)'));
});

test("Three owner-facing registers are linked",()=>{
  for(const name of ["OPEN_REMARKS.md","DEVELOPMENT_REGISTER.md","RELEASE_REGISTER.md"])
    assert.ok(app.includes(name),"Missing register "+name);
});

test("Existing owner login remains on shared staging API",()=>{
  assert.ok(app.includes("freight-staging-ibclzdkxiozbzmniiygv-session"));
  assert.ok(app.includes("functions/v1/freight-api"));
  assert.ok(!app.includes("functions/v1/freight-api-qa-issue47qa"));
  assert.equal(release.task2.backendVersion,53);
  assert.equal(release.task2Complete,false);
  assert.ok(page.includes("app.js?v="+release.servedAppBlobSha.slice(0,12)));
});
