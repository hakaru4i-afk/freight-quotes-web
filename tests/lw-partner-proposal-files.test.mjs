import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const script=readFileSync("test/lw-public-cooperation-20261108.js","utf8");
const css=readFileSync("test/lw-public-cooperation-20261108.css","utf8");
const html=readFileSync("test/index.html","utf8");
const ownerCss=readFileSync("test/owner-command-center-20261108.css","utf8");
const api="https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/api/partner-inquiries";

test("public partnership form attaches files rather than spreadsheet row templates",()=>{
 assert.ok(script.includes('name="attachments"'));
 assert.ok(script.includes('data-task2-csv="1"'));
 assert.match(script,/body:fd/);
 assert.doesNotMatch(script,/JSON\.stringify\(\{partnerKind/);
 assert.match(script,/lw-inquiry-files/);
 assert.match(script,/ownerFile\(e\)/);
 assert.ok(script.includes('cabinet-panel[data-section="overview"]'));
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

test("one synthetic staging proposal persists a genuine PDF file",{skip:process.env.LW_REAL_UPLOAD!=="1"},async()=>{
 const form=new FormData();
 form.append("partnerKind","supplier");
 form.append("company","QA_ONLY_PARTNER_FILES_20261111");
 form.append("contactName","Automated QA");
 form.append("contactDetails","qa-internal@example.invalid");
 form.append("message","Staging-only synthetic document upload, not a real supplier proposal.");
 form.append("consent","on");
 form.append("attachments",new Blob(["%PDF-1.4\\n1 0 obj\\n<<>>\\nendobj\\n%%EOF\\n"],{type:"application/pdf"}),"qa_proposal.pdf");
 const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),30000);
 try{const response=await fetch(api,{method:"POST",headers:{Origin:"https://hakaru4i-afk.github.io"},body:form,signal:abort.signal});
 const body=await response.json();assert.equal(response.status,201,"Valid staging file upload: "+JSON.stringify(body));
 assert.equal(body.ok,true);assert.equal(body.attachmentCount,1);assert.match(body.reference,/^[0-9a-f]{8}$/);
 console.log("QA_PARTNER_UPLOAD_REFERENCE",body.reference);
 }finally{clearTimeout(timeout)}
});

test("Owner cooperation inbox is not concealed by the new command-center CSS",()=>{
 assert.match(ownerCss,/> :not\(#lw-owner-command\):not\(#lw-owner-inquiries\)/);
 assert.match(ownerCss,/#lw-owner-inquiries\{display:block!important/);
 assert.match(html,/owner-command-center-20261108\.css\?v=command-07/);
});
