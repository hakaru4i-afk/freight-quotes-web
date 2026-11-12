import {runtimeAssetUrl} from './helpers/runtime-assets.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {runInNewContext} from "node:vm";

const html=readFileSync("test/index.html","utf8");
const css=readFileSync("test/owner-workspace-compact-20261108.css","utf8");
const nav=readFileSync("test/owner-workspace-compact-20261108.js","utf8");
const help=readFileSync("test/current-workspace-help-20261108.js","utf8");

test("staging loads compact owner assets once; root production is not modified",()=>{
 for(const path of ["owner-workspace-compact-20261108.js","owner-workspace-compact-20261108.css","current-workspace-help-20261108.js"])
   assert.equal(html.split(path).length-1,1,"missing or duplicated asset "+path);
 assert.ok(!html.includes("portal-help-20261108.js"),"legacy duplicate help unexpectedly loaded");
 assert.ok(html.includes(runtimeAssetUrl('current-workspace-help-20261108.css')));
 assert.ok(!html.includes("transport-applications.js"),"deferred document must not be promoted as an active script");
});
test("syntax, no backend mutations, URLs and role permissions unchanged",()=>{
 for(const path of ["test/owner-workspace-compact-20261108.js","test/current-workspace-help-20261108.js"])
   execFileSync(process.execPath,["--check",path]);
 assert.ok(!/fetch\s*\(|XMLHttpRequest|\/api\//.test(nav),"navigation redesign must not call APIs");
 assert.ok(!/removeChild|\.remove\s*\(|\.replaceWith\s*\(/.test(nav),"React owned navigation must not be removed");
 assert.ok(nav.includes('id==="transport-applications"'),"deferred legacy menu must be hidden without deleting code");
 for(const id of ["create-request","request-registry","offers","answers","tender-hub","approved-shipments","winner-chats","transport-claims","incident-journal","supplier-orders","content-tasks","team","access-levels","portal-feedback","help"]){
   assert.ok(nav.includes('"' + id + '"'),"missing canonical route "+id);
 }
});
test("role-safe grouping, no duplicate links, original hrefs and navigation preserved",()=>{
 const ids=["overview","management-reports","transport-applications","supplier-orders","content-tasks","create-request","request-registry","offers","answers","approved-shipments","winner-chats","tender-hub","incident-journal","carrier-service","sla","team","help","transport-claims","access-levels","site-monitor","portal-feedback","portal-feedback"];
 const links=ids.map(id=>{
  const attributes={href:"#"+id};
  const style={store:{},setProperty(k,v){this.store[k]=v}};
  return {dataset:{},style,title:"",tabIndex:0,getAttribute(k){return attributes[k]},setAttribute(k,v){attributes[k]=v}};
 });
 const navElement={classList:{added:[],add(v){this.added.push(v)}},querySelectorAll(){return links}};
 const preview={classList:{members:new Set(),contains(v){return this.members.has(v)},add(v){this.members.add(v)}},querySelector(){return null}};
 const owner={dataset:{},querySelector(s){return s===".cabinet-sidebar nav"?navElement:null}};
 const events={};
 const doc={documentElement:{lang:"ru"},body:{},readyState:"complete",getElementById(){return {}},querySelector(s){return s.includes("cabinet-app")?owner:s===".test-cabinets"?preview:null},addEventListener(k,f){events[k]=f}};
 const context={document:doc,window:{addEventListener(k,f){events[k]=f}},MutationObserver:class{observe(){}},requestAnimationFrame(fn){fn()}};
 runInNewContext(nav,context);
 assert.equal(owner.dataset.lwOwnerHierarchy,"20261108");
 assert.equal(links[0].dataset.lwOwnerGroupStart,"Рабочий стол");
 assert.equal(links[5].dataset.lwOwnerGroupStart,"01 · Заявки и ставки");
 assert.equal(links[9].dataset.lwOwnerGroupStart,"02 · Исполнение");
 assert.equal(links[2].dataset.lwOwnerDeferred,"true");
 assert.equal(links[2].getAttribute("aria-hidden"),"true");
 assert.equal(links.at(-1).dataset.lwOwnerDuplicate,"true");
 assert.equal(links[5].getAttribute("href"),"#create-request");
 assert.ok(Number(links[5].style.store["--lw-owner-order"]) < Number(links[7].style.store["--lw-owner-order"]));
 assert.equal(preview.classList.contains("lw-preview-compact"),true);
 doc.documentElement.lang="en";events.hashchange();
 assert.equal(links[5].dataset.lwOwnerGroupStart,"01 · Requests & quotes");
 doc.documentElement.lang="zh-CN";events.hashchange();
 assert.equal(links[5].dataset.lwOwnerGroupStart,"01 · 询价与报价");
});
test("owner FAQ explains menu hierarchy and distinctions RU EN ZH",()=>{
 for(const txt of ["Карта разделов кабинета владельца","Owner workspace navigation","所有者工作台导航","Рассмотрение ставок","Сроки и ответы","Претензии и акты","Инциденты","Пользователи и доступ","Уровни доступа","Транспортная заявка отложена","06 · Реестры и процессы","FAQ и инструкции по кабинетам","ownerNavigationGuide[l]"])
  assert.ok(help.includes(txt),txt);
 for(const txt of ["roleQuestions","lw-field-help","aria-describedby","owner:","carrier:","purchasing:","supplier:"])
  assert.ok(help.includes(txt),txt);
 assert.ok(css.includes("data-lw-owner-group-start"),"group titles CSS required");
 assert.ok(css.includes("max-width:760px"),"mobile layout required");
});
