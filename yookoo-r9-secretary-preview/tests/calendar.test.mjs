import test,{afterEach} from 'node:test';import assert from 'node:assert/strict';
import {Calendar} from '../src/calendar.js';import {BINDINGS} from '../src/model.js';
const realFetch=globalThis.fetch;afterEach(()=>globalThis.fetch=realFetch);
const env={GOOGLE_ACCESS_TOKEN:'mock-only',GOOGLE_WRITE_ENABLED:'true'};
test('existing recurring instance is patched with etag, not master; replay never writes twice',async()=>{
 const c=new Calendar(env);let patches=0,instance={id:'one-instance',etag:'v1',summary:'English',recurringEventId:BINDINGS.english,originalStartTime:{dateTime:'2026-11-12T20:00:00+07:00'}};
 globalThis.fetch=async(url,init)=>{
  if(url.includes('/instances?'))return Response.json({items:[instance]});
  if(url.endsWith('/'+BINDINGS.english))return Response.json({id:BINDINGS.english,recurrence:['RRULE:FREQ=DAILY']});
  assert.ok(url.endsWith('/one-instance'));
  if(init.method==='PATCH'){patches++;assert.equal(init.headers['If-Match'],'v1');const b=JSON.parse(init.body);assert.equal(b.recurrence,undefined);assert.equal(b.start.timeZone,'Asia/Ho_Chi_Minh');instance={...instance,...b,etag:'v2'};}
  return Response.json(instance);
 };
 const p=await c.prepareMove('english','2026-11-12','20:30','21:30');assert.notEqual(p.event_id,BINDINGS.english);await c.move(p,'op1');await c.move(p,'op1');assert.equal(patches,1);
});
test('changed event etag refuses to overwrite user edits',async()=>{
 const c=new Calendar(env);globalThis.fetch=async()=>Response.json({id:'x',etag:'new'});await assert.rejects(()=>c.move({event_id:'x',etag:'old'},'op'),/CHANGED/);
});
test('create retries stable valid id, reads before writes, uses same calendar',async()=>{
 const c=new Calendar(env);let inserted=null,n=0;globalThis.fetch=async(url,init)=>{
  assert.ok(url.includes('/calendars/primary/events'));
  if(init.method==='POST'){n++;inserted=JSON.parse(init.body);assert.match(inserted.id,/^[0-9a-v]+$/);return Response.json(inserted);}
  if(url.includes('?'))return Response.json({items:[]});
  return inserted?Response.json(inserted):new Response('',{status:404});
 };
 const p={date:'2026-11-12',start:'10:00',end:'10:15',title:'Nhắc tự hỏi BR'};const a=await c.create(p,'same-op'),b=await c.create(p,'same-op');assert.equal(a.id,b.id);assert.equal(n,1);assert.equal(a.attendees,undefined);
});
test('manual identical event introduced after preview is not duplicated',async()=>{
 const c=new Calendar(env);globalThis.fetch=async(url,init)=>{assert.notEqual(init.method,'POST');return url.includes('?')?Response.json({items:[{summary:'Nhắc BR',start:{dateTime:'2026-11-12T10:00:00+07:00'}}]}):new Response('',{status:404});};
 await assert.rejects(()=>c.create({date:'2026-11-12',start:'10:00',end:'10:15',title:'Nhắc BR'},'op'),/DUPLICATE/);
});
test('audit uses all existing IDs, never creates old events or claims missing events synced',async()=>{
 const c=new Calendar(env);let reads=0;globalThis.fetch=async(url,init)=>{assert.equal(init.method,undefined);reads++;return new Response('',{status:404});};const b=await c.audit();assert.equal(reads,Object.keys(BINDINGS).length);assert.ok(Object.values(b).every(x=>x.sync_status==='NOT_FOUND'));
});
test('write permission is explicit, no OAuth or write without configuration',async()=>{
 globalThis.fetch=()=>{throw Error('no network allowed');};const c=new Calendar({});await assert.rejects(()=>c.create({},'x'),/WRITE_DISABLED/);await assert.rejects(()=>c.token(),/NOT_CONNECTED/);
});
test('Google list paginates all events',async()=>{
 let n=0;globalThis.fetch=async()=>Response.json(++n===1?{items:[{id:'one'}],nextPageToken:'two'}:{items:[{id:'two'}]});assert.equal((await new Calendar(env).list('2026-11-12')).length,2);
});
