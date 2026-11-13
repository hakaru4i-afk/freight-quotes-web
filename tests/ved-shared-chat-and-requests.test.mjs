import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../test/"+p,import.meta.url),"utf8");
const chat=read("lw-ved-shared-chat-20261109.js");
const panel=read("task2-panel-sidebar-only-20261107.js");
const css=read("lw-ved-shared-chat-20261109.css");
const html=read("index.html");
const taskHome=read("lw-pending-tasks-all-roles-20261109.js");

test("chat and Task2 modules parse as JavaScript",()=>{
 assert.doesNotThrow(()=>new Function(chat));
 assert.doesNotThrow(()=>new Function(panel));
 assert.doesNotThrow(()=>new Function(taskHome));
});

test("VED uses real Owner/Carrier shared chat API and has no canned message templates",()=>{
 assert.match(chat,/\/api\/chats/);
 assert.match(chat,/\/api\/chat-files\?id=/);
 assert.match(chat,/fd\.set\("requestId",crypto\.randomUUID\(\)\)/);
 assert.match(chat,/fd\.set\("body",body\)/);
 assert.match(chat,/form\.querySelector/);
});
test("VED has active chat menu, shipment history, file attachment and send feedback",()=>{
 assert.match(chat,/const PAGE_ID="lw-ved-chat-page"/);
 assert.match(chat,/class="lw-ved-chat-mount"/);
 assert.match(chat,/href="#chats"/);
 assert.match(chat,/data-vc-orders/);
 assert.match(chat,/data-vc-send/);
 assert.match(chat,/data-vc-status/);
 assert.match(chat,/data-vc-order/);
 assert.match(chat,/data-vc-submit/);
 assert.match(chat,/function renderMessages/);
 assert.match(css,/\.lw-ved-chat-message\.mine/);
});
test("Task2 delegates conversation UI to the separate chats page without embedded duplicate",()=>{
 assert.doesNotMatch(panel,/class="lw-ved-chat-mount"/);
 assert.doesNotMatch(panel,/html\+=form\("message"/);
 assert.doesNotMatch(panel,/class="t2-chat"/);
});
test("VED may assign a document request to a named logistic with inline result",()=>{
 assert.match(panel,/data-t2-form="ved_logistic_docs"/);
 assert.match(panel,/request_logistic_docs/);
 assert.match(panel,/assignedLogin/);
 assert.match(panel,/requestId:crypto\.randomUUID/);
 assert.match(panel,/Направить задачу логисту/);
 assert.match(taskHome,/ved_request_logistic/);
});
test("page deploys separate chat CSS/JS and fresh Task2 asset, not production",()=>{
 assert.match(html,/lw-ved-shared-chat-20261109\.js\?v=/);
 assert.match(html,/lw-ved-shared-chat-20261109\.css\?v=/);
 assert.match(html,/task2-panel-sidebar-only-20261107\.js\?v=/);
 assert.match(html,/lw-pending-tasks-all-roles-20261109\.js\?v=/);
});

test("VED chat is the same real conversation service, not a CSV form; switching requests cannot mix responses",()=>{
 assert.match(chat,/Чаты по заявкам/);
 assert.match(chat,/requestChatId=root\.dataset\.vedChatId/);
 assert.match(chat,/root\.dataset\.vedChatId===requestChatId/);
 assert.match(chat,/root\.dataset\.vedChatId=""/);
 assert.match(chat,/fd\.append\("files",file,file\.name\)/);
 assert.doesNotMatch(chat,/Скачать CSV шаблон|Загрузить CSV|data-t2-csv/);
 assert.doesNotMatch(panel,/class="lw-ved-chat-mount"/);
 assert.doesNotMatch(panel,/html\+=form\("message"/);
});
