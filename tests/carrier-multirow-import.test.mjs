import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const guidance=readFileSync("release/candidates/carrier-multirow-guidance-20261124.js","utf8");
const codec=readFileSync("release/candidates/carrier-multirow-xlsx-20261124.js","utf8");
const marker='new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["lang"]});';
assert.ok(guidance.includes(marker),"actual module exposes imported functions only in test VM");

function harness(){
 class Input{
  constructor(name,type="text",value="",tagName="INPUT"){
   this.name=name;this.type=type;this.tagName=tagName;this._value=String(value);
   this.maxLength=1500;this.min=type==="number"?"0":"";this.max=type==="number"?"9999999":"";
   this.disabled=false;this.readOnly=false;this.events=[];
  }
  get value(){return this._value;}
  set value(v){this._value=String(v);}
  closest(){return null;}
  dispatchEvent(e){this.events.push(e.type);}
 }
 class Select extends Input{}
 class Textarea extends Input{constructor(name,value=""){super(name,"textarea",value,"TEXTAREA");}}
 const fields=[new Input("carrier","text","Дженти-Спедишн"),new Input("contact","text","Отдел логистики")];
 const fieldsFor=prefix=>[
  new Input(prefix+".amount","number",""),
  new Input(prefix+".currency","text","USD"),
  new Input(prefix+".route"),
  new Textarea(prefix+".note"),
  new Input(prefix+".validUntil","date")
 ];
 const prefixes=["initial"];
 fields.push(...fieldsFor("initial"));
 let clicks=0,confirmation=null,notification=null;
 const add={
  get disabled(){return prefixes.length>=20;},
  click(){
   clicks++;
   if(this.disabled)throw Error("20");
   const prefix="variant-"+(prefixes.length+1);
   prefixes.push(prefix);fields.push(...fieldsFor(prefix));
  }
 };
 const form={
  querySelectorAll:()=>fields,
  querySelector:selector=>selector===".add-variant"?add:null
 };
 const context={
  MutationObserver:class{observe(){}},
  document:{documentElement:{},addEventListener(){}},
  window:{addEventListener(){},freightXlsxInterop:null},
  requestAnimationFrame(){},setTimeout,Date,URL,console,
  confirm:text=>{confirmation=text;return true;},
  alert:text=>{notification=text;},
  Event:class{constructor(type){this.type=type;}},
  HTMLInputElement:Input,HTMLTextAreaElement:Textarea,HTMLSelectElement:Select
 };
 vm.runInNewContext(guidance.replace(marker,'globalThis.csvQA={parseCSV,importCSV,quoteFormLayout,exportXlsx};'),context,{timeout:1500});
 const lookup=(prefix,key)=>fields.find(x=>x.name===prefix+"."+key);
 return {
  api:context.csvQA,fields,form,prefixes,lookup,window:context.window,
  clicks:()=>clicks,confirmation:()=>confirmation,notification:()=>notification
 };
}
const file=text=>({name:"quotes.csv",text:async()=>text});

test("CSV: 3 filled data rows => 3 distinct quote variants; empty rows skipped",async()=>{
 const h=harness();
 const content='Перевозчик;Контактное лицо;Сумма ставки;Маршрут;initial.note;initial.validUntil\n'+
  '"Дженти-Спедишн";"Отдел логистики";9550;"Ningbo - Minsk";"Первый";"2026-12-15"\n'+
  '\n'+
  '"";"";9650;"Ningbo - Jinhua - Minsk";"Два\\nраздела";"2026-12-16"\n'+
  '"";"";2665;"Ningbo - Changsha - Minsk";"Третий";"2026-12-17"\n';
 // The actual quoted multiline note includes a real newline.
 const csv=content.replace('"Два\\nраздела"','"Два\nраздела"');
 const parsed=h.api.parseCSV(csv);
 assert.equal(parsed.length,4);
 assert.equal(parsed.sourceRows[1],2);
 assert.equal(parsed.sourceRows[2],4);
 assert.equal(parsed.sourceRows[3],6);
 await h.api.importCSV(h.form,file(csv));
 assert.equal(h.prefixes.length,3);
 assert.equal(h.clicks(),2);
 assert.equal(h.lookup("initial","amount").value,"9550");
 assert.equal(h.lookup("variant-2","amount").value,"9650");
 assert.equal(h.lookup("variant-3","amount").value,"2665");
 assert.equal(h.lookup("variant-2","note").value,"Два\nраздела");
 assert.equal(h.lookup("variant-3","validUntil").value,"2026-12-17");
 assert.match(h.confirmation(),/найдено ставок: 3/);
 assert.match(h.notification(),/Ставки пока НЕ отправлены/);
 assert.equal(h.fields.find(x=>x.name==="carrier").value,"Дженти-Спедишн");
});

test("CSV: only one filled rate uses existing single-row import and creates no duplicate",async()=>{
 const h=harness();
 await h.api.importCSV(h.form,file("Сумма ставки;Маршрут\n1200;Beijing - Minsk\n"));
 assert.equal(h.clicks(),0);
 assert.equal(h.prefixes.length,1);
 assert.equal(h.lookup("initial","amount").value,"1200");
});

test("CSV: 1 rate does not silently leave a second existing quote for submission",async()=>{
 const h=harness();
 h.form.querySelector(".add-variant").click();
 assert.equal(h.prefixes.length,2);
 await assert.rejects(h.api.importCSV(h.form,file("Сумма ставки;Маршрут\n1200;Ningbo - Minsk\n")),/лишние варианты/i);
 assert.equal(h.lookup("initial","amount").value,"");
 assert.equal(h.lookup("variant-2","amount").value,"");
});

test("CSV: invalid last row rejects entire file before changing any field",async()=>{
 const h=harness();
 await assert.rejects(h.api.importCSV(h.form,file(
  "Сумма ставки;Маршрут;initial.validUntil\n"+
  "9550;Route A;2026-12-15\n"+
  "9650;Route B;2026-13-44\n"
  )),/Строка 3.*дата/);
 assert.equal(h.clicks(),0);
 assert.equal(h.lookup("initial","amount").value,"");
 assert.equal(h.confirmation(),null);
});

test("CSV: shared carrier identity cannot differ between quote rows",async()=>{
 const h=harness();
 await assert.rejects(h.api.importCSV(h.form,file(
  'Перевозчик;Сумма ставки\n"One";1000\n"Other";2000\n'
  )),/Строка 3.*общее поле/);
 assert.equal(h.clicks(),0);
});

test("CSV: imported rates replace stale values in existing form variants",async()=>{
 const h=harness();
 h.lookup("initial","route").value="OLD: must not be submitted";
 h.lookup("initial","note").value="OLD NOTE";
 await h.api.importCSV(h.form,file(
  "Сумма ставки;Контактное лицо\n"+
  "1500;Отдел логистики\n"+
  "1600;\n"
 ));
 assert.equal(h.lookup("initial","amount").value,"1500");
 assert.equal(h.lookup("initial","route").value,"");
 assert.equal(h.lookup("initial","note").value,"");
 assert.equal(h.lookup("variant-2","amount").value,"1600");
});

test("CSV: hard 20 variants per file and no silent truncation",()=>{
 const h=harness();
 const input="Сумма ставки;Маршрут\n"+Array.from({length:21},(_,i)=>(1000+i)+";Route "+i).join("\n");
 assert.throws(()=>h.api.parseCSV(input),/не более 20/);
 assert.equal(h.prefixes.length,1);
});

function decodeXml(text){
 return text.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}
function node(xml,tag){
 const children=name=>{
  const hits=[];
  const rx=new RegExp("<"+name+"\\b([^>]*)>([\\s\\S]*?)<\\/"+name+">","g");
  for(const m of xml.matchAll(rx))hits.push(node(m[0],name));
  return hits;
 };
 return {
  getAttribute:name=>{
   const match=RegExp("\\b"+name+'="([^"]*)"').exec(xml.slice(0,xml.indexOf(">")+1));
   return match?match[1]:null;
  },
  getElementsByTagNameNS:(_ns,name)=>children(name),
  getElementsByTagName:name=>children(name),
  get textContent(){return decodeXml(xml.replace(/<[^>]*>/g,""));}
 };
}
class SimpleDOMParser{parseFromString(text){return node(text,"xml");}}
function xlsxApi(){
 const win={};
 vm.runInNewContext(codec,{
  window:win,location:{pathname:"/"},TextEncoder,TextDecoder,Uint8Array,
  DataView,ArrayBuffer,Date,Map,Math,Object,String,Number,RegExp,DOMParser:SimpleDOMParser
 });
 return win.freightXlsxInterop;
}

test("XLSX: all filled worksheet rows reach the importer, not only the first",async()=>{
 const api=xlsxApi(),h=harness();
 const bytes=api.makeXlsx([
  ["Сумма ставки","Маршрут"],
  ["9550","Ningbo - Minsk"],
  ["9650","Ningbo - Jinhua - Minsk"],
  ["2665","Ningbo - Changsha - Minsk"]
 ]);
 const csv=api.xlsxToCsv(await api.unzip(bytes.buffer));
 assert.equal(h.api.parseCSV(csv).length,4);
 assert.deepEqual(Array.from(h.api.parseCSV(csv)[3]),["2665","Ningbo - Changsha - Minsk"]);
 h.window.freightXlsxInterop=api;
 await h.api.importCSV(h.form,{name:"rates.xlsx",arrayBuffer:async()=>bytes.buffer});
 assert.equal(h.prefixes.length,3);
 assert.equal(h.lookup('variant-3','amount').value,'2665');
});

test("XLSX: more than 20 populated rates rejected without silently ignoring rows",async()=>{
 const api=xlsxApi(),headers=["Сумма ставки","Маршрут"];
 const bytes=api.makeXlsx([headers,...Array.from({length:21},(_,i)=>[String(1000+i),"route "+i])]);
 await assert.rejects(async()=>api.xlsxToCsv(await api.unzip(bytes.buffer)),/не более 20/);
});

test("Production assets stay unchanged until the protected release",()=>{
 const current=readFileSync("task2-guidance-42dc6ccc8a20.js","utf8");
 const existingCodec=readFileSync("carrier-csv-wps-hotfix.js","utf8");
 assert.notEqual(current,guidance);
 assert.notEqual(existingCodec,codec);
});
