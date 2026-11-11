import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {seed,interpret,apply,local,due,personal,report,BINDINGS} from '../src/model.js';
import {Journal,once} from '../src/store.js';
import {processText} from '../src/engine.js';
import {Calendar} from '../src/calendar.js';
import {converse} from '../src/assistant.js';
import worker,{SecretaryCoordinator} from '../src/index.js';
import {Meta,KV,now} from './helpers.mjs';
const realFetch=globalThis.fetch;afterEach(()=>globalThis.fetch=realFetch);
function setup(){const meta=new Meta(),kv=new KV(),store=new Journal(kv,meta),calendar=new Calendar({});return {meta,kv,store,calendar};}
async function run(s,t,id){return processText(t,id,s.store,s.meta,s.calendar,{},now);}

test('seed: nine groups, five not started, independent scopes, BR ownership and NSH',()=>{
 const s=seed();assert.equal(Object.values(s.tasks).filter(t=>!t.parent_id).length,9);assert.equal(Object.values(s.tasks).filter(t=>t.work_state==='NOT_STARTED').length,5);
 const t=s.tasks['W01.MC4100_4800'];assert.equal(t.work_state,'INTERNAL_DONE');assert.equal(t.review_state,'AWAITING_FEEDBACK');assert.notEqual(t.review_state,'APPROVED');
 for(let i=1;i<=6;i++){const t=s.tasks['BR0'+i];assert.equal(t.owner,'BR');assert.equal(t.user_role,'MONITOR');}
 assert.match(s.tasks.BR05.title,/công phát sinh/);assert.match(s.tasks.BR06.note,/BTN.*tăng.*giảm cừ tràm.*không di dời/);
 assert.equal(s.attendance['2026-11-09'],'NOT_ATTENDED');assert.equal(s.exceptions[0].return_confirmed,false);
});
test('migration is idempotent and preserves legacy KV',async()=>{
 const s=setup();s.kv.map.set('road_news_seen_v1','["old"]');await s.store.load();await new Journal(s.kv,s.meta).load();assert.equal(s.kv.writes.length,1);assert.equal(s.kv.map.get('road_news_seen_v1'),'["old"]');
});
for(const [text,target,status] of [['Đã xong KCS lún MC 4100–4800, gửi TVGS','W01.MC4100_4800','INTERNAL_DONE'],['Đã xong cống Km3+665','W09.KM3_665','DONE_CONFIRMED'],['BR đã hoàn thành BV trạm cân','BR01','DONE_CONFIRMED']])test('natural scoped update: '+text,()=>{
 const s=seed(),p=interpret(text,s,now);assert.equal(p.target,target);assert.equal(p.patch.work_state,status);apply(s,{...p,id:'x'});assert.equal(s.tasks['W09.KM4_385'].work_state,'IN_PROGRESS');assert.equal(s.tasks.W01.work_state,'IN_PROGRESS');assert.equal(s.tasks.BR02.work_state,'UNKNOWN');
});
test('BR delivered distinct from completed and TVGS approved requires explicit wording',()=>{
 const s=seed();assert.equal(interpret('BR đã giao bản vẽ trạm cân',s,now).patch.delegation_state,'DELIVERED');assert.equal(interpret('MC 4100-4800 TVGS đã chấp thuận',s,now).patch.review_state,'APPROVED');
});
test('ambiguous, negative, conditional, multiple ranges and parents do not auto-close',()=>{
 for(const text of ['Chưa xong Km3+665','Dự kiến xong Km3+665','Đã xong cống','Đã xong Km3+665 và Km4+385'])assert.equal(interpret(text,seed(),now),null);
 assert.ok(interpret('/done W09',seed(),now).question);
});
test('proposal, confirm, duplicate confirmation and undo use durable history',async()=>{
 const s=setup();assert.match(await run(s,'Đã xong cống Km3+665',1),/chưa lưu/);assert.equal((await s.store.load()).tasks['W09.KM3_665'].work_state,'IN_PROGRESS');
 assert.match(await run(s,'/confirm p1',2),/Đã ghi nhận/);assert.equal((await s.store.load()).tasks['W09.KM3_665'].work_state,'DONE_CONFIRMED');
 await run(s,'/confirm p1',3);assert.equal((await s.store.load()).history.length,1);
 await run(s,'/undo confirm-p1',4);await run(s,'/confirm p4',5);assert.equal((await s.store.load()).tasks['W09.KM3_665'].work_state,'IN_PROGRESS');
});
test('stale proposals cannot overwrite later user update',async()=>{
 const s=setup();await run(s,'Đã xong cống Km3+665',1);await run(s,'Đang làm W09.KM3_665',2);await run(s,'/confirm p2',3);await assert.rejects(()=>run(s,'/confirm p1',4),/STALE/);
});
test('trip exception does not mark work done or actually returned',async()=>{
 const s=setup();await run(s,'Mai tôi đi công tác, dự kiến về trước 16h',1);await run(s,'/confirm p1',2);const state=await s.store.load();const e=state.exceptions.at(-1);assert.equal(e.date,'2026-11-12');assert.equal(e.return_confirmed,false);assert.equal(state.tasks['W09.KM3_665'].work_state,'IN_PROGRESS');assert.match(report(state,'08:30',new Date('2026-11-12T08:30:00+07:00')),/tạm hoãn/);
});
test('English exception only affects yesterday, recurring ids kept',async()=>{
 const s=setup();await run(s,'Hôm qua đau đầu chưa học',1);await run(s,'/confirm p1',2);const state=await s.store.load();assert.equal(state.attendance['2026-11-10'],'NOT_ATTENDED');assert.equal(state.bindings.english.event_id,BINDINGS.english);assert.equal(state.attendance['2026-11-11'],undefined);
});
test('all five slots Mon-Sat, Sunday evening only, exact Vietnam clock',()=>{
 for(const date of ['2026-11-14','2026-11-16'])for(const time of ['08:30','11:45','13:30','16:30','21:45'])assert.equal(due(new Date(`${date}T${time}:00+07:00`)),date+':'+time);
 for(const t of ['08:30','11:45','13:30','16:30'])assert.equal(due(new Date('2026-11-15T'+t+':00+07:00')),null);
 assert.ok(due(new Date('2026-11-15T21:45:00+07:00')));assert.equal(local(new Date('2026-11-11T01:30Z')).time,'08:30');
});
test('Saturday driving timing and conditional Nov10 retained, no historical alarm replay',()=>{
 const s=seed();assert.match(personal('2026-11-14',s).join('\n'),/16:45.*16:30.*16:40/);assert.match(personal('2026-11-10',s).join('\n'),/THỰC TẾ về trước 16:00/);assert.doesNotMatch(personal('2026-11-17',s).join('\n'),/THỰC TẾ về trước/);
});
test('no credentials: read-only references, no false sync or AI claims',async()=>{
 const s=setup();globalThis.fetch=()=>{throw Error('must not call external');};assert.match(await run(s,'/calendar',1),/chưa kết nối/);assert.match(await run(s,'Chào bạn',2),/AI chưa được cấu hình/);assert.match(await run(s,'/english',3),/không tự mở Voice/);
});
test('durable pending intent replays after KV write failure exactly once',async()=>{
 const s=setup();await s.store.load();const original=s.kv.put.bind(s.kv);s.kv.put=async()=>{throw Error('offline');};const p=interpret('Đã xong Km3+665',seed(),now);await assert.rejects(()=>s.store.append({...p,id:'one'}));assert.ok(await s.meta.get('pending'));
 s.kv.put=original;const rebuilt=new Journal(s.kv,s.meta);const state=await rebuilt.load();assert.equal(state.history.length,1);assert.equal(state.tasks['W09.KM3_665'].work_state,'DONE_CONFIRMED');await rebuilt.append({...p,id:'one'});assert.equal((await rebuilt.load()).history.length,1);
});
test('acknowledged delivery retry once; ambiguous transport failure never silently duplicates',async()=>{
 const m=new Meta();let n=0;await once(m,'a',async()=>++n);await once(m,'a',async()=>++n);assert.equal(n,1);
 await once(m,'b',async()=>{n++;throw Error('network lost after send');});await once(m,'b',async()=>++n);assert.equal(n,2);assert.equal((await m.get('delivery:b')).status,'UNKNOWN');
});
test('Telegram auth rejects forged token and wrong sender, preview writes nothing',async()=>{
 const env={TELEGRAM_BOT_TOKEN:'mock',TELEGRAM_CHAT_ID:'1'};const req=new Request('https://x/telegram',{method:'POST',body:'{}'});assert.equal((await worker.fetch(req,env)).status,403);
 const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('mock'));const token=Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const authorized=id=>new Request('https://x/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':token},body:JSON.stringify({update_id:1,message:{chat:{id:1},from:{id},text:'/tasks'}})});
 assert.equal((await worker.fetch(authorized(2),env)).status,200);assert.equal((await worker.fetch(authorized(1),env)).status,503);
});
test('coordinator serializes duplicate concurrent webhooks and user confirmations',async()=>{
 const meta=new Meta(),env={YOOKOO_KV:new KV(),TELEGRAM_BOT_TOKEN:'mock',TELEGRAM_CHAT_ID:'1'};const obj=new SecretaryCoordinator({storage:meta},env);let sent=0;globalThis.fetch=async()=>{sent++;return Response.json({ok:true,result:{message_id:sent}});};
 const req=(id,text)=>new Request('https://internal',{method:'POST',body:JSON.stringify({kind:'update',update:{update_id:id,message:{text}}})});
 await Promise.all([obj.fetch(req(1,'Đã xong Km3+665')),obj.fetch(req(1,'Đã xong Km3+665'))]);assert.equal(sent,1);
 await Promise.all([obj.fetch(req(2,'/confirm p1')),obj.fetch(req(2,'/confirm p1'))]);assert.equal(sent,2);assert.equal((await obj.store.load()).history.length,1);
});
test('API dialogue passes stored context, no credentials in prompt, structured output validates',async()=>{
 let body;globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');body=JSON.parse(init.body);return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({reply:'Bạn muốn ưu tiên cống nào?',action:'none',target:''})}]}]});};
 const result=await converse('Hôm nay nên làm gì?',seed(),{OPENAI_API_KEY:'never-in-prompt',OPENAI_MODEL:'configured-model'});assert.equal(result.action,null);assert.equal(body.store,false);assert.ok(!JSON.stringify(body).includes('never-in-prompt'));assert.equal(body.text.format.strict,true);
});
test('scheduler handles retry per local date/slot; legacy 08:30 still daily, secretary excludes Sunday',async()=>{
 const oldNow=Date.now;let sent=[];globalThis.fetch=async(url,init)=>{
  if(url.startsWith('https://api.telegram.org/')){sent.push(JSON.parse(init.body).text);return Response.json({ok:true});}
  return new Response('<rss><channel></channel></rss>');
 };
 try{
  const obj=new SecretaryCoordinator({storage:new Meta()},{YOOKOO_KV:new KV(),TELEGRAM_BOT_TOKEN:'mock',TELEGRAM_CHAT_ID:'1',SECRETARY_REMINDERS:'true'});
  const tick=async iso=>{Date.now=()=>Date.parse(iso);return obj.fetch(new Request('https://internal',{method:'POST',body:JSON.stringify({kind:'tick',time:iso})}));};
  await tick('2026-11-14T08:30:00+07:00');await tick('2026-11-14T08:30:00+07:00');assert.equal(sent.length,3);
  sent=[];await tick('2026-11-15T08:30:00+07:00');assert.equal(sent.length,2);assert.ok(!sent.some(x=>x.includes('THƯ KÝ')));
  sent=[];await tick('2026-11-15T21:45:00+07:00');await tick('2026-11-15T21:45:00+07:00');assert.equal(sent.length,1);assert.match(sent[0],/Chủ nhật/);
  sent=[];Date.now=()=>Date.parse('2026-11-16T10:00:00+07:00');await obj.fetch(new Request('https://internal',{method:'POST',body:JSON.stringify({kind:'tick',time:'2026-11-10T05:30:00+07:00'})}));assert.equal(sent.length,0);
 }finally{Date.now=oldNow;}
});
test('new personal task persists after confirmation, stays out of administrative priority list',async()=>{
 const s=setup();await run(s,'/add personal Mua sách cho con',88);await run(s,'/confirm p88',89);const state=await s.store.load();assert.equal(state.tasks.U88.category,'personal');assert.equal(state.tasks.U88.work_state,'NOT_STARTED');assert.doesNotMatch(report(state,'08:30',now),/Mua sách/);
});
test('offline appointments are explicitly bot-only, confirmed and deduplicated',async()=>{
 const s=setup();await run(s,'/event 2026-11-12 10:00 10:15 Hỏi BR',22);assert.equal((await s.store.load()).appointments.length,0);await run(s,'/confirm p22',23);assert.equal((await s.store.load()).appointments.length,1);assert.match(await run(s,'/event 2026-11-12 10:00 10:15 Hỏi BR',24),/Đã có lịch/);
});
