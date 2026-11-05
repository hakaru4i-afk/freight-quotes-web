/* Issue #47 — real Office Open XML template for carrier rate form (staging only).
   Compatible with Microsoft Excel and WPS; preserves the field/column mapping.
   Replaces only freight-form-fields.csv exports. Converts XLSX input back to
   the existing CSV importer without changing server or production data. */
(() => {
"use strict";
if (!location.pathname.includes("/test/")) return;
const enc=new TextEncoder(),dec=new TextDecoder('utf-8');
const xesc=v=>String(v??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
function splitCSV(source){
 let txt=String(source||"").replace(/^\uFEFF/,"").replace(/^sep=[;,\t]\r?\n/i,"");
 if(!txt.trim())throw Error("Шаблон пустой");
 const first=txt.split(/\r?\n/,1)[0], counts={";":0,",":0,"\t":0};
 let quoted=false;
 for(let i=0;i<first.length;i++){const ch=first[i];if(ch==='"'){if(quoted&&first[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted&&ch in counts)counts[ch]++;}
 const delimiter=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
 if(!counts[delimiter])throw Error("Не найдены отдельные колонки");
 let rows=[],row=[],cell="";quoted=false;
 for(let i=0;i<txt.length;i++){const ch=txt[i];
   if(ch==='"'){if(quoted&&txt[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
   else if(ch===delimiter&&!quoted){row.push(cell);cell="";}
   else if((ch==="\r"||ch==="\n")&&!quoted){if(ch==="\r"&&txt[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell="";}
   else cell+=ch;
 }
 if(quoted)throw Error("CSV: незакрытая кавычка");
 row.push(cell);if(row.some(x=>x!==""))rows.push(row);
 if(rows.length<1||rows[0].length<2)throw Error("Нет раздельных полей");
 return rows;
}
const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc32(a){let c=0xFFFFFFFF;for(const b of a)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
const cat=chunks=>{const n=chunks.reduce((a,b)=>a+b.length,0),out=new Uint8Array(n);let k=0;for(const x of chunks){out.set(x,k);k+=x.length;}return out;};
function zip(files){
 let locals=[],centers=[],offset=0;
 for(const [name,dataText] of Object.entries(files)){
   const filename=enc.encode(name),data=enc.encode(dataText),crc=crc32(data);
   const lh=new Uint8Array(30+filename.length),ld=new DataView(lh.buffer);
   ld.setUint32(0,0x04034b50,true);ld.setUint16(4,20,true);ld.setUint16(6,0x800,true);
   ld.setUint16(8,0,true);ld.setUint32(14,crc,true);ld.setUint32(18,data.length,true);ld.setUint32(22,data.length,true);
   ld.setUint16(26,filename.length,true);lh.set(filename,30);
   const ch=new Uint8Array(46+filename.length),cd=new DataView(ch.buffer);
   cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);cd.setUint16(8,0x800,true);
   cd.setUint32(16,crc,true);cd.setUint32(20,data.length,true);cd.setUint32(24,data.length,true);
   cd.setUint16(28,filename.length,true);cd.setUint32(42,offset,true);ch.set(filename,46);
   locals.push(lh,data);centers.push(ch);offset+=lh.length+data.length;
 }
 const directory=cat(centers),end=new Uint8Array(22),e=new DataView(end.buffer);
 e.setUint32(0,0x06054b50,true);e.setUint16(8,centers.length,true);e.setUint16(10,centers.length,true);
 e.setUint32(12,directory.length,true);e.setUint32(16,offset,true);
 return cat([...locals,directory,end]);
}
function colName(i){let out="";for(i++;i;i=Math.floor((i-1)/26))out=String.fromCharCode(65+(i-1)%26)+out;return out;}
function makeXlsx(rows){
 const size=Math.max(...rows.map(r=>r.length)),ref=colName(size-1);
 const cells=rows.map((r,i)=>'<row r="'+(i+1)+'" ht="'+(i===0?38:25)+'" customHeight="1">'+
   Array.from({length:size},(_,j)=>'<c r="'+colName(j)+(i+1)+'" t="inlineStr"'+(i===0?' s="1"':'')+'><is><t xml:space="preserve">'+xesc(r[j]??"")+'</t></is></c>').join("")+'</row>').join("");
 const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const sheet=xml+'<worksheet xmlns="'+ns+'"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/>'+
  '<cols>'+Array.from({length:size},(_,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="25" customWidth="1"/>').join("")+'</cols>'+
  '<sheetData>'+cells+'</sheetData></worksheet>';
 const types=xml+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
 const rels=xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 const workbook=xml+'<workbook xmlns="'+ns+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ставка перевозчика" sheetId="1" r:id="rId1"/></sheets></workbook>';
 const wrels=xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
 const styles=xml+'<styleSheet xmlns="'+ns+'"><fonts count="2"><font><sz val="11"/><color rgb="FF20332E"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF20332E"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs></styleSheet>';
 return zip({"[Content_Types].xml":types,"_rels/.rels":rels,"xl/workbook.xml":workbook,"xl/_rels/workbook.xml.rels":wrels,"xl/styles.xml":styles,"xl/worksheets/sheet1.xml":sheet});
}
async function unzip(buffer){
 const raw=new Uint8Array(buffer),view=new DataView(buffer),files=new Map();
 let eocd=-1;for(let i=raw.length-22;i>=Math.max(0,raw.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error("Файл не является Excel XLSX");
 const count=view.getUint16(eocd+10,true);let ptr=view.getUint32(eocd+16,true);
 for(let i=0;i<count;i++){
   if(view.getUint32(ptr,true)!==0x02014b50)throw Error("Некорректный XLSX");
   const method=view.getUint16(ptr+10,true),size=view.getUint32(ptr+20,true),nameLen=view.getUint16(ptr+28,true),
    extra=view.getUint16(ptr+30,true),comment=view.getUint16(ptr+32,true),at=view.getUint32(ptr+42,true);
   const name=dec.decode(raw.slice(ptr+46,ptr+46+nameLen));
   if(name.startsWith("xl/")||name==="[Content_Types].xml"){
     const start=at+30+view.getUint16(at+26,true)+view.getUint16(at+28,true);
     const bytes=raw.slice(start,start+size);
     let output;
     if(method===0)output=bytes;
     else if(method===8&&typeof DecompressionStream==="function"){
       const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
       output=new Uint8Array(await new Response(stream).arrayBuffer());
     }else throw Error("Сжатие XLSX не поддерживается браузером");
     files.set(name,dec.decode(output));
   }
   ptr+=46+nameLen+extra+comment;
 }
 return files;
}
function xlsxToCsv(files){
 const parse=s=>new DOMParser().parseFromString(s,"application/xml");
 const sheetText=files.get("xl/worksheets/sheet1.xml");
 if(!sheetText)throw Error("В XLSX отсутствует первый лист");
 const xml=parse(sheetText);
 if(xml.getElementsByTagName("parsererror").length)throw Error("Ошибка структуры листа");
 const strings=parse(files.get("xl/sharedStrings.xml")||"<sst/>");
 const shared=[...strings.getElementsByTagNameNS("*","si")].map(si=>[...si.getElementsByTagNameNS("*","t")].map(n=>n.textContent).join(""));
 const styles=files.get("xl/styles.xml")?parse(files.get("xl/styles.xml")):null;
 const xfs=styles?[...styles.getElementsByTagNameNS("*","cellXfs")].flatMap(n=>[...n.getElementsByTagNameNS("*","xf")]):[];
 const custom=new Map(styles?[...styles.getElementsByTagNameNS("*","numFmt")].map(n=>[Number(n.getAttribute("numFmtId")),n.getAttribute("formatCode")||""]):[]);
 const rows=[];
 for(const row of [...xml.getElementsByTagNameNS("*","row")].slice(0,2)){
   const cells=[];
   for(const c of row.getElementsByTagNameNS("*","c")){
     const ref=c.getAttribute("r")||"",label=(ref.match(/^[A-Z]+/)||[])[0]||"A";
     let idx=0;for(const letter of label)idx=idx*26+letter.charCodeAt(0)-64;idx--;
     const type=c.getAttribute("t"),v=c.getElementsByTagNameNS("*","v")[0]?.textContent||"";
     let val=type==="s"?(shared[Number(v)]??""):type==="inlineStr"?[...c.getElementsByTagNameNS("*","t")].map(n=>n.textContent).join(""):v;
     if(type!=="s"&&type!=="inlineStr"&&val!==""){
       const xf=xfs[Number(c.getAttribute("s")||0)],fid=Number(xf?.getAttribute("numFmtId")||0),fmt=custom.get(fid)||"";
       if((fid>=14&&fid<=22)||/[ymd]/i.test(fmt.replace(/"[^"]*"/g,""))){
         const d=new Date(Date.UTC(1899,11,30)+Number(val)*86400000);
         if(!isNaN(d.getTime()))val=d.toISOString().slice(0,10)+(fid===22||/[hHsS]/.test(fmt)?"T"+d.toISOString().slice(11,16):"");
       }
     }
     cells[idx]=val;
   }
   rows.push(cells);
 }
 if(rows.length<2||rows[0].length<2)throw Error("В Excel должны быть заголовки и строка значений");
 const width=rows[0].length;
 const quote=x=>'"'+String(x??"").replace(/"/g,'""')+'"';
 return "\uFEFF"+rows.slice(0,2).map(r=>Array.from({length:width},(_,i)=>quote(r[i])).join(";")).join("\r\n")+"\r\n";
}
window.freightXlsxInterop=Object.freeze({makeXlsx,unzip,xlsxToCsv});
})();
