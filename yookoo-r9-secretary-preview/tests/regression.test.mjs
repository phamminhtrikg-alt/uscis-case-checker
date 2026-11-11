// All outbound calls mocked; no actual USCIS/Telegram requests.
import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const names='visaStatus,caseStatus,caseMessage,roadMessage,telegramLong,webhookSecret,VISA_JSON,VISA_API,VISA_CACHE,PRIORITY,nextMonth,dayDifference,gapText,visaSummary,prepareVisaNotice,visaNotice,sendVisaReport,VISA_DELIVERED';
const {default:worker,...api}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../src/legacy.js',import.meta.url),'utf8')+`\nexport {${names}};`).toString('base64'));
const {visaStatus,caseStatus,caseMessage,roadMessage,telegramLong,webhookSecret,VISA_JSON,VISA_API,VISA_CACHE,PRIORITY,nextMonth,dayDifference,gapText,visaSummary,prepareVisaNotice,visaNotice,sendVisaReport,VISA_DELIVERED}=api;
const now=new Date('2026-11-11T04:40:00Z');
const real=JSON.parse(readFileSync(new URL('../evidence/live-source-1.txt',import.meta.url),'utf8'));
const originalFetch=globalThis.fetch;afterEach(()=>{globalThis.fetch=originalFetch;});
function store(initial={}){const map=new Map(Object.entries(initial)),writes=[];return {map,writes,async get(k){return map.get(k)||null;},async put(k,v){writes.push(k);map.set(k,JSON.parse(v));}};}
function net(routes={}){globalThis.fetch=async(url,opt)=>{const v=routes[String(url)];return v===undefined?new Response('',{status:503}):Response.json(v);};}

for(const command of ['/case','/check','/CHECK','/detail','/health','/road','/news','CRON'])test(command+' never requests USCIS even with old API secrets',async()=>{
 const sent=[],calls=[];globalThis.fetch=async(url,opt)=>{
  calls.push(String(url));assert.ok(!String(url).includes('uscis.gov'),'USCIS must not be requested');
  if(String(url).startsWith('https://api.telegram.org/')){sent.push(JSON.parse(opt.body).text);return Response.json({ok:true});}
  if(url===VISA_JSON)return Response.json(real);
  return new Response('<rss><channel></channel></rss>');
 };
 const kv=store(),env={TELEGRAM_BOT_TOKEN:'mock-only',TELEGRAM_CHAT_ID:'1',YOOKOO_KV:kv,USCIS_API_MODE:'production',USCIS_CLIENT_SECRET:'unused-secret'};
 if(command==='CRON')await worker.scheduled({},env,{});
 else {const req=new Request('https://test/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':await webhookSecret(env.TELEGRAM_BOT_TOKEN)},body:JSON.stringify({message:{chat:{id:1},text:command}})});assert.equal((await worker.fetch(req,env)).status,200);}
 if(['/check','/CHECK','/detail','CRON'].includes(command)){
  assert.equal(sent.length,2);assert.match(sent[0],/IOE8434753880/);assert.match(sent[0],/528 ngày/);
  assert.match(sent[1],/Hoàng Văn Thụ/i);assert.match(sent[1],/Mặt bằng/);assert.match(sent[1],/Xây lắp/);assert.match(sent[1],/không đồng nghĩa chưa có tiến triển/);
  writeFileSync(new URL('../evidence/check-MOCK.md',import.meta.url),'# MÔ PHỎNG /check — không gửi Telegram thật\n\n'+sent.join('\n\n--- TIN TIẾP THEO ---\n\n'));
 }
 if(command==='/case'){
  assert.equal(calls.length,1);assert.match(sent[0],/EAC1490165690/);assert.match(sent[0],/https:\/\/egov.uscis.gov\//);assert.match(sent[0],/TRẠNG THÁI ĐÃ GHI NHẬN/);
 }
 if(command==='/road')assert.match(sent[0],/Hoàng Văn Thụ/i);
 for(const s of sent){assert.ok(s.length<=4096);assert.doesNotMatch(s,/VỪA ĐỌC USCIS|HTTP 403|API_PRODUCTION|unused-secret/);}
 assert.ok(!kv.writes.some(k=>k.startsWith('uscis')));
});
test('road report retains baseline and explicit source failure when RSS down',()=>{
 const s=roadMessage({checked:false,errors:['HTTP 503'],feedSuccess:0,feedTotal:8,candidates:[],newItems:[],hasComparison:false});
 assert.match(s,/Hoàng Văn Thụ/i);assert.match(s,/Chưa truy cập được nguồn tin/);assert.match(s,/không phải tin mới/);
});
test('road report displays discovered relevant article',()=>{
 const x={date:'2026-11-11',title:'Cà Mau đường Vành đai 2 Hoàng Văn Thụ',link:'https://example.test/article'};
 assert.match(roadMessage({checked:true,errors:[],feedSuccess:4,feedTotal:8,candidates:[x],newItems:[x],hasComparison:true}),/https:\/\/example.test\/article/);
});
test('long road message is delivered completely across Telegram limits',async()=>{
 const original='Đường Vành đai\n'+'A'.repeat(9000)+'\nhttps://example.test/end';const sent=[];
 globalThis.fetch=async(url,opt)=>{sent.push(JSON.parse(opt.body).text);return Response.json({ok:true});};
 await telegramLong({TELEGRAM_BOT_TOKEN:'mock'},'1',original);assert.equal(sent.join(''),original);assert.ok(sent.every(x=>x.length<=3900));
});
function bulletin(month,a='2012-11-22',b='2012-12-01') {
 return {bulletin:month,rows:[{bulletin:month,kind:'family',country:'ROW',category:'F4',chart:'final_action',date:a},{bulletin:month,kind:'family',country:'ROW',category:'F4',chart:'dates_for_filing',date:b}]};
}
test('priority corrected to April 3, exact UTC day gaps and strict equality',()=>{
 assert.equal(PRIORITY,'2014-04-03');assert.equal(dayDifference(PRIORITY,'2012-10-22'),528);assert.equal(dayDifference(PRIORITY,'2012-11-01'),518);
 assert.match(gapText('2014-04-03'),/trùng ngày/);assert.match(gapText('2014-04-04'),/vượt ngày ưu tiên 1 ngày/);
 assert.match(gapText('C'),/không có mốc/);assert.match(gapText('U'),/không có số ngày/);assert.equal(dayDifference(PRIORITY,'U'),null);
});
test('December bulletin is detected in November immediately, with future applicability label',async()=>{
 net({[VISA_JSON]:bulletin('2026-12')});const kv=store();const v=await visaStatus({YOOKOO_KV:kv},true,now);
 assert.equal(v.month,'2026-12');assert.equal(v.upcoming,true);assert.equal(v.fresh,true);
 const n=await prepareVisaNotice(v,{YOOKOO_KV:kv});assert.equal(n.kind,'new-month');assert.match(visaNotice(v,n),/CÓ LỊCH CHIẾU KHÁN MỚI/);assert.match(visaSummary(v),/cho tháng tới/);
 assert.match(visaSummary(v),/497 ngày/);assert.match(visaSummary(v),/488 ngày/);
});
test('far-future malformed publisher month rejected and year rollover supported',async()=>{
 net({[VISA_JSON]:bulletin('2099-12')});const v=await visaStatus({},false,now);assert.equal(v.origin,'baseline');assert.match(v.error,/FUTURE_MONTH_REJECTED/);
 assert.equal(nextMonth('2026-12'),'2027-01');
});
test('health/source snapshot writes never consume the new-month notice',async()=>{
 const kv=store();net({[VISA_JSON]:bulletin('2026-12')});const v=await visaStatus({YOOKOO_KV:kv},true,now);
 assert.ok(!kv.map.has(VISA_DELIVERED));assert.equal((await prepareVisaNotice(v,{YOOKOO_KV:kv})).kind,'new-month');
});
test('new bulletin alert saved only after Telegram acknowledges; next report not repeatedly special',async()=>{
 const kv=store(),env={YOOKOO_KV:kv,TELEGRAM_BOT_TOKEN:'test'};const sent=[];
 const v={month:'2026-12',a:'2012-11-22',b:'2012-12-01',fresh:true,upcoming:true};
 globalThis.fetch=async(url,opt)=>{assert.ok(!kv.map.has(VISA_DELIVERED)||sent.length===1);sent.push(JSON.parse(opt.body).text);return Response.json({ok:true});};
 await sendVisaReport(env,'1',v,visaSummary(v));await sendVisaReport(env,'1',v,visaSummary(v));
 assert.match(sent[0],/CÓ LỊCH CHIẾU KHÁN MỚI/);assert.doesNotMatch(sent[1],/CÓ LỊCH CHIẾU KHÁN MỚI/);assert.equal(kv.map.get(VISA_DELIVERED).month,'2026-12');
});
test('Telegram 500 preserves pending new bulletin alert',async()=>{
 const kv=store(),env={YOOKOO_KV:kv,TELEGRAM_BOT_TOKEN:'test'},v={month:'2026-12',a:'2012-11-22',b:'2012-12-01',fresh:true};
 net();await assert.rejects(()=>sendVisaReport(env,'1',v,'mock bulletin'));assert.ok(!kv.map.has(VISA_DELIVERED));assert.equal((await prepareVisaNotice(v,env)).kind,'new-month');
});
test('same-month correction and retrogression are announced as revision',async()=>{
 const kv=store({[VISA_DELIVERED]:{version:1,month:'2026-12',a:'2012-11-22',b:'2012-12-01'}});
 const v={month:'2026-12',a:'2012-10-22',b:'2012-12-01',fresh:true};const n=await prepareVisaNotice(v,{YOOKOO_KV:kv});
 assert.equal(n.kind,'revision');assert.match(visaNotice(v,n),/A lùi 31 ngày/);assert.match(visaNotice(v,n),/B không đổi/);
});
test('old/cached data never raises a new bulletin alarm',async()=>{
 assert.equal((await prepareVisaNotice({month:'2026-12',a:'C',b:'C',fresh:false},{})).kind,null);
 const kv=store({[VISA_DELIVERED]:{version:1,month:'2026-12',a:'C',b:'C'}});
 assert.equal((await prepareVisaNotice({month:'2026-11',a:'C',b:'C',fresh:true},{YOOKOO_KV:kv})).kind,null);
});
test('December demonstration explicitly labelled hypothetical',async()=>{
 const v={month:'2026-12',a:'2012-11-22',b:'2012-12-01',fresh:true,upcoming:true,origin:'mirror',source:VISA_JSON};
 const n=await prepareVisaNotice(v,{});
 writeFileSync(new URL('../evidence/new-bulletin-MOCK.md',import.meta.url),'# MÔ PHỎNG: số liệu tháng 12 tự đặt để test, KHÔNG phải bulletin thật\n\n```text\n'+visaNotice(v,n)+visaSummary(v)+'```\n');
});
