import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const script=readFileSync(new URL("../owner-answer-filters-20261124.js",import.meta.url),"utf8");
const page=readFileSync(new URL("../index.html",import.meta.url),"utf8");
test("answer deadline filters load in owner portal",()=>{
 assert.match(page,/owner-answer-filters-20261124\.js/);
 for(const label of ["Срок с","Срок по","Номер заказа","Перевозчик","Статус ответа","Сбросить"])
   assert.ok(script.includes(label),label);
});
test("filtering is presentation-only, with stable deadline range and Minsk date",()=>{
 assert.match(script,/timeZone:"Europe\/Minsk"/);
 assert.match(script,/deadline>=state\.from/);
 assert.match(script,/deadline<=state\.to/);
 assert.match(script,/row\.style\.display/);
 assert.doesNotMatch(script,/fetch\s*\(|XMLHttpRequest|localStorage|POST|PATCH|DELETE/);
});
