import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

const bundle = readFileSync("test/app.js", "utf8");
const page = readFileSync("test/index.html", "utf8");
const encode = (s) => s.replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"));

test("permanent delete: only current records displayed and no restore/trash filter", () => {
  assert.match(bundle, /let x=h\.filter\(C=>!C\.hidden&&/);
  assert.match(bundle, /N==="delete"\?\(R\(null\),M\(null\),window\.dispatchEvent/);
  assert.ok(bundle.includes(encode("Удалить навсегда")));
  assert.ok(bundle.includes(encode("Восстановление невозможно.")));
  assert.ok(!bundle.includes('children:u?"' + encode("Корзина пуста.") + '"'));
  assert.ok(!bundle.includes('C.hidden?"' + encode("В корзине ") + '\\xB7 '));
  assert.ok(!bundle.includes('children:"' + encode("Показать корзину") + '"'));
  assert.ok(!bundle.includes('action:"restore",kind:D.kind'));
});

test("staging boot uses exact current bundle hash so browser cache updates", () => {
  const sha = execFileSync("git", ["hash-object", "test/app.js"], {encoding:"utf8"}).trim();
  assert.ok(page.includes("app.js?v=" + sha.slice(0,12)), "staging asset version must equal file SHA");
});

test("production root entrypoint not used as staging asset", () => {
  assert.match(page, /<title>Тестовая среда/);
  assert.match(page, /src="\.\/app\.js\?v=/);
});
