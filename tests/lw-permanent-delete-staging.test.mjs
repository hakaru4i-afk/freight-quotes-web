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

test("approved Owner command-04 still has full-width layout, role switch and SL", () => {
  const css = readFileSync("test/owner-command-center-20261108.css", "utf8");
  const js = readFileSync("test/owner-command-center-20261108.js", "utf8");
  const nav = readFileSync("test/owner-workspace-compact-20261108.js", "utf8");
  const help = readFileSync("test/current-workspace-help-20261108.js", "utf8");
  assert.ok(page.includes("owner-command-center-20261108.css?v=command-05"));
  assert.ok(page.includes("owner-command-center-20261108.js?v=command-04"));
  assert.ok(css.includes("Exact full-bleed approved layout"));
  assert.ok(css.includes("max-width:none!important;width:100%!important;margin:0!important"));
  assert.ok(css.includes("grid-template-columns:220px minmax(0,1fr)!important"));
  assert.ok(css.includes("body.lw-cc-role-open.lw-cc-owner-view .test-cabinets"));
  assert.ok(js.includes("function syncRolePanel(cab,active)"));
  assert.ok(js.includes("⚙ Просмотр кабинетов ▾"));
  assert.ok(js.includes("Service Level (SL)"));
  assert.ok(js.includes('request("/api/service-level?overview=1")'));
  assert.ok(js.includes("return Array.isArray(state.registry)?state.registry.filter(r=>r&&!r.hidden)"));
  assert.ok(nav.includes('id==="transport-applications"'));
  assert.ok(nav.includes('seen.has(id)'));
  for (const text of ["Карта разделов кабинета владельца","Owner workspace navigation","所有者工作台导航","lw-field-help"])
    assert.ok(help.includes(text), "missing owner guide: " + text);
});
