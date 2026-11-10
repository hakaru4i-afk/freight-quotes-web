#!/usr/bin/env node
/**
 * Fail-closed production readiness gate for Task #1 and Task #2.
 * Synthetic browser/unit success never becomes authorized end-to-end PASS.
 * No credentials are read, logged or written.
 */
import {readFile,writeFile,mkdir} from "node:fs/promises";
const roster=JSON.parse(await readFile("test/qa-observer.json","utf8"));
const ids=[...roster.task1.cases,...roster.task2.cases].map(x=>x.id);
if(new Set(ids).size!==37||ids.length!==37)throw Error("Invalid acceptance roster: expected exactly 37 unique groups");
async function readJson(path){try{return JSON.parse(await readFile(path,"utf8"))}catch{return null}}
const robot=await readJson(process.env.ROBOT_REPORT_PATH||"reports/task12-robot-matrix.json");
const e2e=await readJson("reports/private-authenticated-e2e.json");
const restore=await readJson("reports/private-restore-evidence.json");
const visual=await readJson("reports/private-visual-evidence.json");
const backup=await readJson("reports/private-production-backup-evidence.json");
const security=await readJson("reports/private-role-security-evidence.json");
const deployment=await readJson("reports/private-staging-deployment-evidence.json");
const validations=[];
function gate(key,condition,note,proof){
 const passed=condition===true;
 validations.push({id:key,status:passed?"PASS":"BLOCKED",note,evidenceId:passed?(proof?.artifactId||null):null});
}
const stamp=new Date().toISOString();
const sha=process.env.GITHUB_SHA||null;
const e2eSteps=Array.isArray(e2e?.scenarios)?e2e.scenarios:[];
const evidences=new Map(e2eSteps.filter(x=>typeof x?.id==="string").map(x=>[x.id,x]));
const hasRoleEvidence=x=>x&&x.status==="PASS"&&x.mode==="AUTHENTICATED_QA_API"&&typeof x.actorRole==="string"&&x.actorRole.length>0&&x.evidence&&x.evidence.method==="HTTP_AND_BROWSER"&&x.evidence.responseVerified===true&&x.evidence.traceId;
const missing=ids.filter(id=>!hasRoleEvidence(evidences.get(id)));
gate("E2E_37_37",!!e2e&&e2e.environment==="isolated-qa"&&e2e.authorized===true&&missing.length===0,
  "Требуются 37 независимых авторизованных E2E-сценариев с проверенным ответом API и доказательством. Отсутствуют: "+missing.join(", "),
  e2e);
gate("E2E_RUN_PROVENANCE",!!e2e&&!!sha&&e2e.runId===process.env.GITHUB_RUN_ID&&e2e.frontendSha===sha&&typeof e2e.backendSha==="string"&&e2e.backendSha.length===40,
  "Доказательства должны относиться именно к этой версии frontend/API и текущему автоматическому запуску.",
  e2e);
gate("SECURITY_ROLES_AND_IDOR",security?.environment==="isolated-qa"&&security?.result==="PASS"&&security?.protectedResources===true&&security?.actorCount>=5,
  "Независимые роли Owner/CarrierA/B/ВЭД/Поставщик; запреты доступа к чужой заявке, файлам, данным и операциям подтверждены.",
  security);
gate("FILES_STORAGE_SHA",security?.fileUploadDownloadSha256==="PASS"&&security?.foreignFileDenied===true,
  "Тестовые файлы загружены и скачаны байт-в-байт через авторизованный Storage, чужому перевозчику отказано.",
  security);
gate("VISUAL_DESKTOP_MOBILE",visual?.result==="PASS"&&visual?.viewport390===true&&visual?.desktop===true&&visual?.noHorizontalOverflow===true&&visual?.noBlockingOverlaps===true,
  "Проверка читаемости, контрастности, невидимых кнопок, перекрытий и 390×844/desktop с артефактами.",
  visual);
gate("VERSION_AND_DEPLOYED_PARITY",deployment?.result==="PASS"&&deployment?.environment==="staging"&&deployment?.frontendSha===sha&&deployment?.backendMatchesCandidate===true&&deployment?.servedAssetsExact===true,
  "Фактически отданный Pages frontend и staging API должны точно соответствовать протестированной паре.",
  deployment);
gate("ISOLATED_RESTORE",restore?.result==="PASS"&&restore?.databaseRestored===true&&restore?.storageRestored===true&&restore?.isolationVerified===true,
  "Восстановление БД/Storage в независимой QA-среде, изоляция от общей staging и контроль отката.",
  restore);
gate("PRODUCTION_BACKUP_AND_RESTORE",backup?.result==="PASS"&&backup?.encrypted===true&&backup?.readbackSha256===true&&backup?.separateRestore===true,
  "Реальный зашифрованный бэкап production с SHA-256, обратным чтением и отдельным восстановлением; без него выпуск запрещён.",
  backup);
const robotScenarios=Array.isArray(robot?.scenarios)?robot.scenarios:[];
gate("CURRENT_ROBOT_REPORT",!!robot&&!!sha&&robot.commit===sha&&robotScenarios.length===ids.length&&
  new Set(robotScenarios.map(x=>x.id)).size===ids.length&&ids.every(id=>robotScenarios.some(x=>x.id===id))&&
  robotScenarios.every(x=>["PARTIAL","PASS"].includes(x.status))&&robot.checks?.FAIL===0&&robot.checks?.BLOCKED===0,
  "Требуется полный отчёт робота для текущего SHA, без FAIL/BLOCKED; публичный исторический отчёт не заменяет артефакт запуска.",robot);
const ownerCase=evidences.get("T1-01");
gate("T1_01_REQUIRED_FIELDS",hasRoleEvidence(ownerCase)&&ownerCase?.evidence?.negativeValidation===true&&ownerCase?.evidence?.serverRejectsMissingFields===true,
  "Открытый дефект T1-01: кнопка и сервер должны запрещать публикацию с пустыми обязательными полями.",
  e2e);
gate("NO_CRITICAL_FAILURES",!!e2e&&Array.isArray(e2e.criticalDefects)&&e2e.criticalDefects.length===0&&!!robot&&robot.checks?.FAIL===0,
  "До выпуска должно быть ноль FAIL и открытых критичных замечаний; зелёный smoke не является приёмкой.",
  e2e);
const blockers=validations.filter(x=>x.status!=="PASS");
const summary={
 schemaVersion:1,
 generatedAt:stamp,
 environment:"staging",
 status:blockers.length===0?"READY_FOR_OWNER_RELEASE_APPROVAL":"RELEASE_BLOCKED",
 canDeployProduction:false,
 note:"Данный gate никогда не разворачивает production автоматически. Даже после READY нужно отдельное явное разрешение Владельца.",
 frontendCandidateSha:sha,
 backendCandidateSha:e2e?.backendSha||null,
 robotPartialChecks:robot?.checks?.PARTIAL??null,
 robotFailures:robot?.checks?.FAIL??null,
 authenticatedE2ePassed:ids.length-missing.length,
 authenticatedE2eRequired:ids.length,
 blockers:blockers.map(x=>({id:x.id,reason:x.note})),
 checks:validations,
 workflowUrl:process.env.GITHUB_RUN_ID?"https://github.com/hakaru4i-afk/freight-quotes-web/actions/runs/"+process.env.GITHUB_RUN_ID:null
};
await mkdir("reports",{recursive:true});
await writeFile("reports/task12-release-readiness.json",JSON.stringify(summary,null,2)+"\n");
console.log("RELEASE_GATE",summary.status,"checks="+validations.length,"blocked="+blockers.length,"fullE2E="+summary.authenticatedE2ePassed+"/"+ids.length);
console.log("REPORT reports/task12-release-readiness.json");
for(const b of blockers)console.log("BLOCKED",b.id,String(b.note||"").slice(0,370));
if(blockers.length)process.exitCode=1;
