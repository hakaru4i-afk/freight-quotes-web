import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Source-level UI contract with a real execution of the document renderer.
// Backend acceptance and role restrictions are verified separately.
const source=readFileSync("test/task2-panel-sidebar-only-20261107.js","utf8");
const begin=source.indexOf(" function renderTab(");
const end=source.indexOf(" function taskCard(",begin);
assert.ok(begin>=0&&end>begin,"extract current Task2 document renderer");
const block=source.slice(begin,end);
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const makeRenderer=role=>{
 const state={tab:"documents",role,login:role==="carrier"?"carrier@qa.test":"ved@qa.test",logistics:[]};
 return new Function("state","esc","fmt","docTypes","taskCard","departurePlans",String.raw