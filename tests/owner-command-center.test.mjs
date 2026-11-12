import {runtimeAssetUrl} from './helpers/runtime-assets.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const html=readFileSync("test/index.html","utf8");
const js=readFileSync("test/owner-command-center-20261108.js","utf8");
const css=readFileSync("test/owner-command-center-20261108.css","utf8");
const hero=readFileSync("test/owner-command-hero-20261108.svg","utf8");
test("published Owner module is unique and staging-only",()=>{
 for(const name of ["owner-command-center-20261108.js","owner-command-center-20261108.css"])assert.equal(html.split(name).length-1,1,name);
 assert.ok(html.includes(runtimeAssetUrl('owner-command-center-20261108.js')));
 assert.ok(html.includes(runtimeAssetUrl('owner-command-center-20261108.css')));
 assert.ok(!html.includes("https://hakaru4i-afk.github.io/freight-quotes-web/?page="),"must not call production");
});
test("valid JS and SVG, roles and source-backed data only",()=>{
 execFileSync(process.execPath,["--check","test/owner-command-center-20261108.js"]);
 assert.match(hero,/<svg\b/);
 assert.match(hero,/<\/svg>/);
 assert.match(js,/data-cabinet-role="owner"/);
 for(const path of ["/api/workload","/api/registry","/api/shipments","/api/service-level?overview=1"])assert.ok(js.includes(path),"missing live API "+path);
 assert.ok(!/\bPOST\b|\bPATCH\b|\bDELETE\b/.test(js),"dashboard must not mutate API");
 assert.ok(!/\b86%|\b24<\/strong>|\b56 перевозок/.test(js),"mock KPI values cannot ship");
 for(const x of ["state.workload","state.registry","state.shipments","state.sl","carrierStats()","transportStats()","cleanRegistry()","cleanShipments()"])assert.ok(js.includes(x),x);
});
test("functional quick links and all staged sections",()=>{
 for(const x of ["create-request","request-registry","tender-hub","approved-shipments","carrier-service","management-reports","help","team","incident-journal"])assert.ok(js.includes(x),x);
 assert.ok(js.includes('safeRoute(id)'),"reject broken/unsafe user-provided navigation");
 assert.ok(js.includes('aria-selected'),"tabs need interactive selection");
 assert.ok(js.includes("escapeHTML("),"UI values must be escaped");
});
test("desktop mobile styling, owner only and original overview retained",()=>{
 assert.match(css,/max-width:395px/);
 assert.match(css,/max-width:760px/);
 assert.match(css,/lw-cc-triad/);
 assert.match(css,/lw-cc-sl-donut/);
 assert.match(css,/lw-cc-table-scroll/);
 assert.match(css,/data-cabinet-role="owner"/);
 assert.match(css,/> :not\(#lw-owner-command\):not\(#lw-owner-inquiries\)/,"Partner inbox must remain visible on Owner overview");
 assert.ok(!css.includes("body{display:none"),"site must not be hidden");
 assert.ok(css.includes('url("./lw-approved-freight-20261108.jpg")'),"the detailed freight artwork must replace the flat illustration");
 assert.ok(css.includes('url("./lw-approved-plane-20261108.jpg")'),"the detailed aircraft image must be included");
 for(const asset of ["lw-approved-freight-20261108.jpg","lw-approved-plane-20261108.jpg"])
   assert.ok(readFileSync("test/"+asset).length>4500,"missing hero photo "+asset);
 assert.ok(css.includes("OWNER-COMMAND-04"),"whole-Owner dark theme must be present");
 assert.ok(css.includes("max-width:none!important;margin:0!important"),"remove centered dashboard width cap");
 assert.ok(js.includes('cab.classList.add("lw-cc-active")'),"Owner shell must survive tab navigation");
 assert.ok(js.includes("syncRolePanel(cab,true)"),"header role picker must stay mounted");
});

test("Owner group heading does not inherit the active-link cyan vertical stroke",()=>{
 assert.match(css,/OWNER-COMMAND-06/);
 assert.match(css,/\.lw-owner-nav>a\[data-lw-owner-group-start\]::before/);
 const fix=css.slice(css.lastIndexOf("OWNER-COMMAND-06"));
 for(const marker of ["bottom:auto!important","width:max-content!important","height:auto!important","background:none!important","box-shadow:none!important"]){
  assert.ok(fix.includes(marker),"missing pseudo marker reset "+marker);
 }
});
