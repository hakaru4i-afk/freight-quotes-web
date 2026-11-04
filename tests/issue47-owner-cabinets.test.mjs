import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../test/app.js", import.meta.url), "utf8");
const component = source.slice(source.indexOf("function X0()"), source.indexOf("Se();function K0"));
const roles = ["carrier", "logistic", "supplier", "designer", "content", "purchasing", "certification"];
const users = roles.map(role => ({role, login: "test." + role, name: role}));

function render(payload) {
  let index = 0;
  const posted = [];
  const storage = new Map();
  const node = (type, props, key) => ({type, props, key});
  const tree = runInNewContext(component + "\nX0()", {
    yo: {useState: initial => [index++ === 0 ? payload : initial, () => {}], useEffect: () => {}},
    window: {freightPreviewKey: "preview", freightNavigate: () => {}},
    sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    fetch: async (path, options) => {
      assert.equal(path, "/api/test-cabinets");
      posted.push(JSON.parse(options.body).login);
      return {ok: true, json: async () => ({})};
    },
    r: node, o: node, J: value => value, ke: value => value,
  });
  const buttons = [];
  const walk = value => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value?.props) {
      if (value.type === "button") buttons.push(value);
      walk(value.props.children);
    }
  };
  walk(tree);
  return {buttons, posted, storage};
}

test("Owner selects seven roles and can return to the eighth cabinet", async () => {
  const {buttons, posted, storage} = render({environment: "staging", presets: [], users});
  for (const role of roles) {
    const button = buttons.find(button => button.key === role);
    assert.equal(button.props.disabled, false);
    await button.props.onClick();
    assert.equal(storage.get("preview"), "test." + role);
  }
  await buttons[0].props.onClick();
  assert.equal(storage.has("preview"), false);
  assert.deepEqual(posted, [...users.map(user => user.login), ""]);
});

test("Unavailable role cannot be selected and non-owner response exposes no controls", () => {
  const {buttons} = render({environment: "staging", presets: [], users: users.slice(0, 4)});
  for (const role of roles.slice(4)) assert.equal(buttons.find(button => button.key === role).props.disabled, true);
  assert.equal(render(null).buttons.length, 0);
});
