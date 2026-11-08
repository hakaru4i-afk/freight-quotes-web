import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync("test/lw-hover-safe-20261108.css","utf8");
const index=readFileSync("test/index.html","utf8");

test("staging loads hover shield after every cabinet and page stylesheet",()=>{
 const paths=[...index.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(paths.at(-1),"./lw-hover-safe-20261108.css?v=lw-hover-03");
 assert.ok(paths.some(p=>p.startsWith("./owner-command-center-20261108.css")));
 assert.equal(index.includes("href=\"./lw-hover-safe-20261108.css"),true);
});

test("shimmer and high-brightness hover are suppressed across all cabinets",()=>{
 assert.match(css,/\[data-cabinet-role\] \.btn::after/);
 assert.match(css,/content:none!important/);
 assert.match(css,/filter:none!important/);
 assert.match(css,/text-shadow:none!important/);
 assert.match(css,/transform:none!important/);
 assert.match(css,/\.btn:not\(\.secondary\):not\(\.ghost\):hover/);
 assert.match(css,/\.btn:is\(\.secondary,\.ghost\):hover/);
 assert.match(css,/#task2-root \.t2-stage/);
 assert.match(css,/#portal-feedback-root/);
 assert.match(css,/\.compact-transport-document/);
 assert.match(css,/\.cycle-login/);
 assert.match(css,/\.carrier-portal/);
 assert.match(css,/prefers-reduced-motion/);
 assert.ok(!/filter:\s*brightness\((1\.[1-9]|[2-9])/i.test(css));
});

test("production stylesheet is not modified or included in the staging patch",()=>{
 const production=readFileSync("index.html","utf8");
 assert.ok(!production.includes("lw-hover-safe-20261108.css"),"production must remain unchanged");
});
