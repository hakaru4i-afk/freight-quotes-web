import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const script=readFileSync("test/lw-public-cooperation-20261108.js","utf8");
const css=readFileSync("test/lw-public-cooperation-20261108.css","utf8");
const html=readFileSync("test/index.html","utf8");
const api="https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/api/partner-inquiries";

test("public partnership form attaches files rather than spreadsheet row templates",()=>{
 assert.match(script,/name=\\"attachments\\"/);
 assert.match(script,/data-task2-csv=\\"1\\"/);
 assert.match(script,/body:fd/);
 assert.doesNotMatch(script,/JSON\.stringify\(\{partnerKind/);
 assert.match(script,/lw-inquiry-files/);
 assert.match(script,/ownerFile\(e\)/);
 assert.match(script,/cabinet-panel\[data-section=\\"overview\\"\]/);
 assert.match(css,/#lw-contact-form \.t2-legacy-csv\{display:none!important\}/);
 assert.match(html,/lw-public-cooperation-20261108\.js\?v=692702b4670c/);
 assert.match(html,/lw-public-cooperation-20261108\.css\?v=e0b399fec9cf/);
});

test("private Owner attachments cannot be read anonymously",async()=>{
 const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),30000);
 try{
  const response=await fetch(api+"/attachments/00000000-0000-4000-8000-000000000000",{headers:{Origin:"https://hakaru4i-afk.github.io"},signal:ctrl.signal});
  assert.ok([401,403].includes(response.status),"Anonymous access should be denied, actual: "+response.status);
 }finally{clearTimeout(timeout)}
});

test("server rejects forged PDF and never saves its proposal",async()=>{
 const fd=new FormData();fd.append("partnerKind","carrier");fd.append("company","QA forged file, must reject");fd.append("contactName","Testing Only");
 fd.append("contactDetails","qa@example.invalid");fd.append("message","Reject invalid file magic, do not store.");fd.append("consent","on");
 fd.append("attachments",new Blob(["NOT A PDF"],{type:"application/pdf"}),"quote.pdf");
 const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),30000);
 try{
  const response=await fetch(api,{method:"POST",headers:{Origin:"https://hakaru4i-afk.github.io"},body:fd,signal:ctrl.signal});
  assert.equal(response.status,400,"Forged PDF should fail before database insert; got "+response.status);
 }finally{clearTimeout(timeout)}
});
