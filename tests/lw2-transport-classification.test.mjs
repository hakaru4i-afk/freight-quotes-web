import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const paths=['lw2-staging-20261107.js','test/lw2-staging-20261107.js'];
const fixtures=[['ЖД','rail'],['ж.д.','rail'],['Ж / Д','rail'],['ж-д','rail'],['Ж/Д','rail'],['железнодорожная перевозка','rail'],['Railroad','rail'],['铁路','rail'],['鐵路','rail'],['Авто','auto'],['truck','auto'],['公路','auto'],['море','sea'],['ocean','sea'],['海運','sea'],['Авиа','air'],['air freight','air'],['空运','air'],['ЖД + Авто','multi'],['rail/road','multi'],['多式联运','multi'],['铁路+海运','multi'],['carrier','unknown'],['research','unknown'],['между','unknown'],['','unknown'],[null,'unknown']];
for(const file of paths)test('mode classification: '+file,()=>{
 const source=readFileSync(file,'utf8');
 const modes=source.match(/const modes=\[[\s\S]*?\];/);
 const classifier=source.match(/function classify\(mode\)\{[\s\S]*?\n \}/);
 assert.ok(modes&&classifier,'extract actual classifier and table');
 const classify=runInNewContext(modes[0]+'\n'+classifier[0]+'\nclassify');
 for(const [input,expected] of fixtures)assert.equal(classify(input),expected,JSON.stringify(input));
});
