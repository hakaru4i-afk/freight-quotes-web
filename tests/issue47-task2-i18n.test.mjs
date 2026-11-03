import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const original=readFileSync("test/task2-i18n.js","utf8");
const injected=original.replace("schedule();\n})();","globalThis.__t2I18nQA={update,dict,language};\n})();");
assert.ok(injected.includes("globalThis.__t2I18nQA"));
const nodes=[
 {nodeValue:"Исполнение и трекинг",parentElement:{closest:()=>null}},
 {nodeValue:" Документы и ВЭД ",parentElement:{closest:()=>null}},
 {nodeValue:"User shipping address custom text",parentElement:{closest:()=>null}}
];
const docRoot={lang:"ru"};
const document={
 documentElement:docRoot,
 querySelector(sel){if(sel==="#task2-root")return root;return null},
 createTreeWalker(root){let i=0;return {nextNode(){return nodes[i++]||null}}},
 addEventListener(){}
};
const root={querySelectorAll(){return []}};
const ctx={
 document,window:{addEventListener(){}},
 NodeFilter:{SHOW_TEXT:4},
 MutationObserver:class{observe(){}},
 requestAnimationFrame(){},
};
vm.runInNewContext(injected,ctx,{timeout:1000});
const mod=ctx.__t2I18nQA;

test("translation catalog covers major screens in both EN and ZH",()=>{
 for(const k of ["Исполнение и трекинг","Документы и ВЭД","ПТО и приёмка","Претензии и акты","Сохранить изменения","Акт по морской перевозке","Номера Bitrix"]){
  assert.ok(mod.dict[k],k);
  assert.ok(mod.dict[k][0]?.length>2,k+" English");
  assert.ok(mod.dict[k][1]?.length>2,k+" Chinese");
 }
 assert.ok(Object.keys(mod.dict).length>=100);
});
test("switching language preserves original labels and does not translate user data",()=>{
 docRoot.lang="en";mod.update();
 assert.equal(nodes[0].nodeValue,"Execution & tracking");
 assert.equal(nodes[1].nodeValue," Documents & foreign trade ");
 assert.equal(nodes[2].nodeValue,"User shipping address custom text");
 docRoot.lang="zh-CN";mod.update();
 assert.equal(nodes[0].nodeValue,"运输执行与跟踪");
 assert.equal(nodes[1].nodeValue," 文件与外贸 ");
 docRoot.lang="ru";mod.update();
 assert.equal(nodes[0].nodeValue,"Исполнение и трекинг");
 assert.equal(nodes[1].nodeValue," Документы и ВЭД ");
});
test("staging only, loader pinned to exact translation file SHA",()=>{
 const html=readFileSync("test/index.html","utf8");
 assert.match(html,/task2-i18n\.js\?v=[a-f0-9]{12}/);
 assert.ok(!readFileSync("index.html","utf8").includes("task2-i18n.js"));
});
