import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("test/app.js", "utf8");
const prod = fs.readFileSync("app.js", "utf8");
const info = JSON.parse(fs.readFileSync("test/build-info.json", "utf8"));
const html = fs.readFileSync("test/index.html", "utf8");

test("carrier offer status prioritizes final round outcome over bid admission", () => {
  assert.match(src, /function issue47CarrierBidStatus\(x\)/);
  assert.match(src, /x\?\.selected_offer\|\|x\?\.round_result==="winner"/);
  assert.match(src, /case"lost":return "Не выбран · архив"/);
  assert.match(src, /case"no_response":return "Нет ответа · архив"/);
  assert.match(src, /case"declined":return "Отказался · архив"/);
  assert.match(src, /case"annulled":return "Аннулировано · архив"/);
  assert.match(src, /"Допущена к рассмотрению"/);
  assert.equal(src.split("issue47CarrierBidStatus(x)").length - 1, 3);
  assert.match(src, /x\.round_result==="lost"\?"Архив · не выбран"/);
  assert.ok(!prod.includes("issue47CarrierBidStatus"), "production must stay unchanged");
});

test("staging script cache bust matches recorded artifact", () => {
  assert.equal(info.environment, "staging");
  assert.ok(html.includes("./app.js?v=" + info.servedAppBlobSha.slice(0,12)));
});
