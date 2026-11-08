import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {execFileSync} from "node:child_process";

const source=readFileSync("test/current-workspace-help-20261108.js","utf8");
const html=readFileSync("test/index.html","utf8");

test("staging loads exactly one current FAQ and never loads the redundant draft",()=>{
  assert.equal((html.match(/current-workspace-help-20261108\.js/g)||[]).length,1);
  assert.ok(!html.includes('portal-help-20261108.js'));
  assert.ok(html.includes('task2-guidance-42dc6ccc8a20.js'));
  assert.ok(html.includes('current-workspace-help-20261108.css'));
});
test("current help parses and contains localized workflow and feedback guidance",()=>{
  execFileSync(process.execPath,["--check","test/current-workspace-help-20261108.js"]);
  for(const token of ["ru:{","en:{","zh:{","owner:[","carrier:[","supplier:[","content:[","purchasing:[","designer:[","certification:["])
    assert.ok(source.includes(token),token);
  for(const token of ["«Предложения»","«Мои перевозки»","Excel или WPS","运输申请目前暂缓","Transport-application drafting is deferred","field.type==="])
    assert.ok(source.includes(token),token);
  assert.match(source,/getClientRects/);
  assert.match(source,/portal-feedback-root/,{message:"Portal-feedback forms should receive field help, not be skipped"});
});
function mock(){
  const events={};
  let activeRole="carrier";
  let fields=[];
  const host={element:null,querySelector(s){return s==="#lw-current-help"?this.element:null;},prepend(x){this.element=x;}};
  const root={getAttribute(){return activeRole;},querySelectorAll(){return fields;}};
  const document={
    documentElement:{lang:"ru"},body:{},
    querySelector(s){return s===".cabinet-app"?root:s==='.cabinet-panel[data-section="help"]'?host:null;},
    getElementById(s){return s==="root"?root:null;},
    createElement(tag){
      return {tagName:tag.toUpperCase(),textContent:"",innerHTML:"",dataset:{},className:"",
        get classList(){return {contains:name=>this.className.split(" ").includes(name)}}};
    }
  };
  const context={document,window:{freightAccess:{role:"carrier"},addEventListener:(type,fn)=>events[type]=fn},
    MutationObserver:class{observe(){}},requestAnimationFrame:fn=>fn()};
  const makeField=(name,caption,type="text")=>{
    const label={textContent:caption};
    const element={
      type,name,placeholder:"",labels:[label],nextElementSibling:null,title:"",
      getClientRects(){return [1]},
      closest(selector){return selector==="label"?label:null},
      insertAdjacentElement(where,child){assert.equal(where,"afterend");this.nextElementSibling=child;}
    };
    return element;
  };
  runInNewContext(source,context);
  return {host,document,events,makeField,setRole:r=>activeRole=r,setFields:x=>fields=x,
    refresh:()=>events.hashchange()};
}
test("role FAQs update with language and role changes without duplicating panels",()=>{
  const v=mock();
  assert.match(v.host.element.innerHTML,/Мои заявки/);
  assert.match(v.host.element.innerHTML,/Предложения/);
  v.setRole("owner");v.refresh();
  assert.match(v.host.element.innerHTML,/Выберите ровно одну ставку/);
  v.document.documentElement.lang="en";v.refresh();
  assert.match(v.host.element.innerHTML,/How do I use the Excel template/);
  v.document.documentElement.lang="zh-CN";v.refresh();
  assert.match(v.host.element.innerHTML,/如何使用 Excel 模板/);
  assert.equal(v.host.element.dataset.version,"zh-owner");
});
test("field help explains bid amount, feedback category, and checkboxes",()=>{
  const v=mock();
  const rate=v.makeField("amount","Сумма ставки");
  const kind=v.makeField("category","Тип обращения","select-one");
  const check=v.makeField("confirmed","Подтверждаю данные","checkbox");
  v.setFields([rate,kind,check]);v.refresh();
  assert.match(rate.nextElementSibling.textContent,/Цена именно этого варианта ставки/);
  assert.match(kind.nextElementSibling.textContent,/Доработка/);
  assert.match(check.nextElementSibling.textContent,/Отметьте после выполнения/);
  assert.equal(rate.title,rate.nextElementSibling.textContent);
  v.refresh();assert.equal(rate.nextElementSibling.className,"lw-field-help");
});
