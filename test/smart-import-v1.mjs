// Freight Quotes staging: structured, conservative document-to-request matching.
// No external calls; this runs in the user's browser.
const ALIASES = {
 order_code:["order no","order number","order #","po no","po number","purchase order","purchase order no","buyer order","номер заказа","№ заказа","заказ номер","订单号","订单编号"],
 origin:["address for loading","loading address","place of loading","pickup address","pickup location","warehouse address","ship from","пункт погрузки","адрес погрузки","адрес загрузки","место погрузки","装货地址","提货地址","装货地点","工厂地址"],
 destination:["delivery address","final destination","destination address","ship to","destination","delivery place","пункт назначения","конечная точка прибытия","адрес доставки","место доставки","目的地","收货地址","交货地址"],
 weight:["gross weight","gross weight kg","g.w.","g.w.(kg)","g.w. kg","total g.w.","total g.w.","total gross weight","gross wt","total weight kg","вес брутто","вес брутто кг","общий вес","毛重","总毛重","总重量"],
 volume:["total cbm","total volume","total volume m3","volume","volume m3","cbm","c.b.m.","объем","объём","объем м3","объём м3","кубатура","体积","总体积","立方米"],
 ready_date:["readiness","readiness date","cargo ready","cargo ready date","ready date","goods ready date","ready for shipment","date of readiness","дата готовности","дата готовности груза","готовность груза","货好日期","备货日期","交货日期"],
 cargo:["cargo description","goods description","description of goods","product description","item description","commodity","goods","product name","item name","наименование груза","груз","наименование товара","описание товара","货物名称","产品名称","品名"],
 incoterm:["incoterms","incoterm","terms of delivery","delivery terms","trade terms","shipping terms","условия поставки","инкотермс","贸易术语","交货条款"],
};
const CHOICES=new Set(["EXW","FCA","CPT","CIP","DAP","DPU","DDP","FAS","FOB","CFR","CIF"]);
const clean=s=>String(s??"").replace(/\u00a0/g," ").trim();
const norm=s=>clean(s).toLowerCase().replace(/ё/g,"е").replace(/[.()#,№:：/_-]/g," ").replace(/\s+/g," ").trim();
const mapped=new Map(Object.entries(ALIASES).flatMap(([key,aliases])=>aliases.map(a=>[norm(a),key])));
function keyOf(s){
 const v=norm(s);
 if(!v||v.length>60)return null;
 if(mapped.has(v))return mapped.get(v);
 if(/^(?:total\s+)?g\s*w\s*(?:kg)?$/.test(v))return "weight";
 if(/^(?:total\s+)?cbm\s*(?:m3)?$/.test(v))return "volume";
 if(/^(?:total\s+)?gross\s+weight\s*(?:kg|kgs)?$/.test(v))return "weight";
 if(/^order\s*(?:no|number)\s*$/.test(v))return "order_code";
 if(/^ready\s*date$/.test(v))return "ready_date";
 return null;
}
function numberOf(v){
 let s=clean(v).replace(/[^\d.,\s-]/g,"").replace(/\s+/g,"");
 if(!s||s.startsWith("-"))return null;
 if(/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s))s=s.replace(/,/g,"");
 else if(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s))s=s.replace(/\./g,"").replace(",",".");
 else if(s.includes(",")&&!s.includes("."))s=s.replace(",",".");
 else if(s.includes(",")&&s.includes("."))return null;
 if(!/^\d+(?:\.\d+)?$/.test(s))return null;
 const n=Number(s);
 return Number.isFinite(n)&&n>0&&n<1e9?n:null;
}
function dateOf(v){
 const s=clean(v);
 let y,m,d,a=s.match(/(?:^|[^\d])(20\d{2})[./-](\d{1,2})[./-](\d{1,2})(?:$|[^\d])/);
 if(a){y=Number(a[1]);m=Number(a[2]);d=Number(a[3]);}
 else{
  a=s.match(/(?:^|[^\d])(\d{1,2})[./-](\d{1,2})[./-](20\d{2})(?:$|[^\d])/);
  if(a){y=Number(a[3]);m=Number(a[2]);d=Number(a[1]);}
  else if(/^\d{5}(?:\.\d+)?$/.test(s)&&Number(s)>35000&&Number(s)<75000){
    const dt=new Date(Date.UTC(1899,11,30)+Math.floor(Number(s))*86400000);
    return dt.toISOString().slice(0,10);
  }else return null;
 }
 const dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d?dt.toISOString().slice(0,10):null;
}
function valueOf(key,raw,header=""){
 const s=clean(raw);
 if(!s||keyOf(s)||s.length>650)return null;
 if(key==="order_code"){
  if(s.length>65||/\b(?:ITEM\s+NO|UNIT\s+PRICE|TOTAL\s+CBM|DEC\s+PRICE|G\.W\.)\b/i.test(s))return null;
  if(!/^[a-z0-9][a-z0-9._/-]{3,64}$/i.test(s))return null;
  if(!/[0-9]/.test(s))return null;
  return s;
 }
 if(key==="weight"||key==="volume"){
  if(/[@*×x]|\b(?:item|pcs|ctn|cartons?|unit|price|amount|email|phone)\b/i.test(s))return null;
  const match=s.match(/^\s*(\d[\d\s.,]*)(?:\s*(kg|kgs|g|grams?|tonnes?|tons?|m3|m³|cbm|кг|г|т|吨|立方米))?\s*$/i);
  if(!match)return null;
  const n=numberOf(match[1]); if(n==null)return null;
  let value=n;
  if(key==="weight"){
   if(/\b(?:grams?|gr)\b|(?:^|[\d\s])г(?:$|\s)|克/.test(s)&&!/\bkg\b|кг/.test(s))value=n/1000;
   else if(/(?:^|[\d\s])t(?:$|\s)|tonne|тонн|吨/i.test(s)&&!/\bkg\b|кг/.test(s))value=n*1000;
  }
  if(key==="volume"&&/cm3|cm³|см3|см³/i.test(s))value=n/1e6;
  if(key==="volume"&&/litres?|литр/i.test(s))value=n/1000;
  return value>0&&value<1e9?String(Math.round(value*1e6)/1e6):null;
 }
 if(key==="ready_date")return dateOf(s);
 if(key==="incoterm"){const match=s.toUpperCase().match(/\b(?:EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)\b/);return match&&CHOICES.has(match[0])?match[0]:null;}
 if(key==="origin"||key==="destination"||key==="cargo"){
  if(s.length<3||/^\d+(?:[.,]\d+)?$/.test(s)||/^(?:ITEM|PRICE|PCS|CTN|ORDER|TOTAL|COUNTRY|CITY)\b/i.test(s))return null;
  if(/@|\b(?:e-?mail|phone|telephone|mobile|fax|tel\.?|contact|whatsapp|wechat|website|https?|www\.)\b|邮箱|电话|联系人/i.test(s))return null;
  if(key==="origin"&&/\b(?:maximum load|dimensions?|size|price|amount|order|units?|pieces?|kg|grams?|cm|mm|cartons?|ctn|pcs|item)\b/i.test(s))return null;
  if(/^\d+(?:[.,]\d+)?\s*[×x*]\s*\d+/i.test(s))return null;
  if(key==="cargo"&&/^[a-z]{1,4}[-\d/]+$/i.test(s))return null;
  if(key==="origin"&&/^(?:no|yes|n\/a)$/i.test(s))return null;
  return s.slice(0,key==="cargo"?500:300);
 }
 return null;
}
function parseRows(text){
 const rows=[];let sheet="Документ", row=0;
 for(const line of String(text||"").split(/\r?\n/)){
  const sh=line.match(/^\[SHEET\s+(.+)\]$/i);
  if(sh){sheet=sh[1];row=0;continue;}
  const page=line.match(/^\[PAGE\s+(\d+)\]$/i);
  if(page){sheet="PDF стр. "+page[1];row=0;continue;}
  row++;
  if(!line.trim())continue;
  rows.push({cells:line.includes("\t")?line.split("\t").map(clean):[clean(line)],sheet,row,raw:line});
 }
 return rows;
}
function columnLetter(i){let s="";for(let n=i+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
export function analyzeDocument(text,{orderCode="",allowedFields=[],filename=""}={}){
 const rows=parseRows(text),found=[],order=clean(orderCode).toUpperCase().replace(/\s/g,"");
 const allowed=new Set(allowedFields);
 const add=(key,raw,source,priority=0,group="")=>{
  const value=valueOf(key,raw);if(!value)return;
  if(found.length>=180)return;
  const bonus=["weight","volume"].includes(key)&&/(?:\btotal\b|итого|общий|сумма|总)/i.test(source)?25:0;
  found.push({key,value,evidence:source.slice(0,300),priority:priority+bonus,group});
 };
 // Read structured XLSX / CSV / TSV rows, preserving empty cells and column positions.
 for(let i=0;i<rows.length;i++){
  const header=rows[i],cols=header.cells;
  if(cols.length<2)continue;
  const keys=cols.map(keyOf);
  if(!keys.some(Boolean))continue;
  // Suppress a long row of text from being misclassified as a header.
  if(keys.filter(Boolean).length===1&&cols.length<3&&cols.some(x=>x.length>150))continue;
  const orderCol=keys.indexOf("order_code");
  const next=Math.min(rows.length,i+60);
  let targetRows=[];
  for(let k=i+1;k<next;k++){
   const row=rows[k];if(row.sheet!==header.sheet)break;
   if(row.cells.length>=2&&row.cells.map(keyOf).filter(Boolean).length>=2)break;
   if(row.cells.length<2)continue;
   if(row.cells.every(x=>!x))continue;
   const ov=orderCol>=0?clean(row.cells[orderCol]||"").toUpperCase().replace(/\s/g,""):"";
   if(order&&ov&&ov!==order)continue;
   targetRows.push({row,k,ov});
  }
  // Avoid filling from unrelated orders when multiple different order numbers exist.
  if(orderCol>=0&&order&&targetRows.some(x=>x.ov===order))targetRows=targetRows.filter(x=>x.ov===order);
  if(orderCol>=0&&order&&targetRows.length===0)continue;
  const tableGroup=header.sheet+":"+header.row+(orderCol>=0&&order&&targetRows.length&&targetRows.every(x=>x.ov===order)?"#ORDER":"");
  for(const {row} of targetRows){
   for(let j=0;j<keys.length;j++){
    const key=keys[j];if(!key)continue;
    const cell=clean(row.cells[j]||"");if(!cell)continue;
    const label=cols[j]||"";
    const source=header.sheet+" · "+columnLetter(j)+row.row+" ("+label+")";
    add(key,cell,source,90,tableGroup);
   }
  }
 }
 // Read vertical key-value layouts and PDF/DOCX/OCR labels.
 for(let i=0;i<rows.length;i++){
  const row=rows[i],cs=row.cells;
  for(let j=0;j<cs.length;j++){
   const cell=cs[j];
   const key=keyOf(cell);
   if(key){
    const next=cs.slice(j+1).find(v=>!!v&&!keyOf(v));
    if(next)add(key,next,row.sheet+" · "+columnLetter(j+1)+row.row+" ("+cell+")",70);
    if(cs.length===1&&i+1<rows.length&&rows[i+1].sheet===row.sheet){
     const following=rows[i+1].cells.join(" ").trim();
     const isNumeric=["weight","volume"].includes(key);
     const canPair=!isNumeric||/\btotal\b|итого|общий|总/i.test(cell)||/\b(?:kg|kgs|cbm|m3|m³|кг|м3|м³|立方米)\b/i.test(following);
     if(following&&!keyOf(following)&&canPair)add(key,following,row.sheet+" · строка "+rows[i+1].row+" ("+cell+")",isNumeric?50:55);
    }
   }
   let m=cell.match(/^(.{3,65}?)\s*[:：]\s*(.{1,450})$/);
   if(m){const k=keyOf(m[1]);if(k)add(k,m[2],row.sheet+" · "+columnLetter(j)+row.row+" ("+m[1]+")",80);}
   else{
    m=cell.match(/^(.{3,45}?)\s{2,}(.{2,450})$/);
    if(m){const k=keyOf(m[1]);if(k)add(k,m[2],row.sheet+" · "+columnLetter(j)+row.row+" ("+m[1]+")",55);}
   }
  }
 }
 // A confirmed order identifier in the document is useful for checking, never to overwrite the owner's order.
 if(order&&!found.some(x=>x.key==="order_code")&&String(text).toUpperCase().includes(order))
  add("order_code",order,"Номер заказа найден в тексте документа",40);
 const grouped=new Map();
 for(const item of found){
  if(!grouped.has(item.key))grouped.set(item.key,new Map());
  const m=grouped.get(item.key);
  const valueKey=item.key==="order_code"?item.value.toUpperCase():item.value;
  if(!m.has(valueKey)||m.get(valueKey).priority<item.priority)m.set(valueKey,item);
 }
 const candidates=[],auto={},warnings=[];
 for(const [key,values] of grouped){
  let items=[...values.values()].sort((a,b)=>b.priority-a.priority);
  if(key!=="order_code"&&items.length>1){const best=items[0].priority;items=items.filter(x=>x.priority>=Math.max(55,best-15));}
  if(items.length>1&&order){
   const isOrder=key==="order_code";
   if(isOrder){const same=items.filter(x=>x.value.toUpperCase().replace(/\s/g,"")===order);if(same.length)items=same;}
  }
  for(const v of items) candidates.push({...v,id:"smart-"+candidates.length,page:1});
  if(!allowed.has(key)||key==="order_code")continue;
  // Only unambiguous values may auto-populate the owner's form.
  if(items.length===1&&items[0].priority>=55)auto[key]=items[0].value;
  else if(items.length>1&&items.every(x=>x.priority>=90&&x.group&&x.group===items[0].group&&x.group.endsWith("#ORDER"))&&["weight","volume"].includes(key))auto[key]=String(Math.round(items.reduce((n,x)=>n+Number(x.value),0)*1e6)/1e6);
  else if(items.length>1&&items.every(x=>x.priority>=90&&x.group&&x.group===items[0].group&&x.group.endsWith("#ORDER"))&&key==="cargo")auto[key]=items.map(x=>x.value).join("; ").slice(0,500);
  else if(items.length>1) warnings.push("Неоднозначное поле: "+key+" ("+items.length+" значений)");
 }
 if(order&&grouped.has("order_code")&&![...grouped.get("order_code").keys()].some(v=>v.replace(/\s/g,"")===order))warnings.push("Номер заказа в документе не совпадает с заявкой");
 return {candidates,auto,warnings,filename,rowsRead:rows.length};
}
