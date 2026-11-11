import {BINDINGS,TZ,validDate} from './model.js';
async function json(url,init={}){const r=await fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(12000)});if(!r.ok){const e=Error('CALENDAR_HTTP_'+r.status);e.status=r.status;throw e;}return r.json();}
export class Calendar {
 constructor(env){this.env=env;this.calendarId=env.GOOGLE_CALENDAR_ID||'primary';this.base='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(this.calendarId)+'/events';}
 configured(){return !!(this.env.GOOGLE_ACCESS_TOKEN||(this.env.GOOGLE_REFRESH_TOKEN&&this.env.GOOGLE_CLIENT_ID&&this.env.GOOGLE_CLIENT_SECRET));}
 async token(){
  if(this.env.GOOGLE_ACCESS_TOKEN)return this.env.GOOGLE_ACCESS_TOKEN;
  if(!this.configured())throw Error('CALENDAR_NOT_CONNECTED');
  const d=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:this.env.GOOGLE_REFRESH_TOKEN,client_id:this.env.GOOGLE_CLIENT_ID,client_secret:this.env.GOOGLE_CLIENT_SECRET}).toString()});
  if(!d.access_token)throw Error('CALENDAR_AUTH_FAILED');return d.access_token;
 }
 async request(path='',init={}){return json(this.base+path,{...init,headers:{Authorization:'Bearer '+await this.token(),'Content-Type':'application/json',...init.headers}});}
 async get(id){return this.request('/'+encodeURIComponent(id));}
 async list(date){
  if(!validDate(date))throw Error('BAD_DATE');const q=new URLSearchParams({timeMin:date+'T00:00:00+07:00',timeMax:date+'T23:59:59+07:00',singleEvents:'true',orderBy:'startTime',maxResults:'250',timeZone:TZ});
  const items=[];let page=null;do{if(page)q.set('pageToken',page);const d=await this.request('?'+q);items.push(...d.items||[]);page=d.nextPageToken;}while(page);return items;
 }
 async audit(){const bindings={};for(const [name,id] of Object.entries(BINDINGS)){
  try{const e=await this.get(id);bindings[name]={event_id:e.id,calendar_id:this.calendarId,timezone:e.start?.timeZone||TZ,recurrence:e.recurrence||[],sync_status:e.status==='cancelled'?'CANCELLED':'VERIFIED',summary:e.summary,etag:e.etag};}
  catch(e){bindings[name]={event_id:id,calendar_id:this.calendarId,timezone:TZ,sync_status:e.status===404?'NOT_FOUND':'UNVERIFIED'};}
 }return bindings;}
 async prepareMove(name,date,start,end){
  if(!BINDINGS[name]||!validDate(date)||!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||start>=end||end>'23:59'||start>'23:59'||start.slice(3)>'59'||end.slice(3)>'59')throw Error('BAD_CALENDAR_TIME');
  const master=await this.get(BINDINGS[name]);let event=master;
  if(master.recurrence){const q=new URLSearchParams({timeMin:date+'T00:00:00+07:00',timeMax:date+'T23:59:59+07:00',timeZone:TZ,maxResults:'250'});const all=[];let page;do{if(page)q.set('pageToken',page);const d=await this.request('/'+encodeURIComponent(master.id)+'/instances?'+q);all.push(...d.items||[]);page=d.nextPageToken;}while(page);const matches=all.filter(x=>(x.originalStartTime?.dateTime||x.originalStartTime?.date||'').slice(0,10)===date);if(matches.length!==1)throw Error('INSTANCE_NOT_UNIQUE');event=matches[0];}
  else if((event.start?.dateTime||event.start?.date||'').slice(0,10)!==date)throw Error('EVENT_DATE_MISMATCH');
  if(!event.etag||event.status==='cancelled')throw Error('EVENT_NOT_EDITABLE');
  return {kind:'calendar_move',event_id:event.id,master_id:master.id,etag:event.etag,date,start,end,summary:event.summary||name,recurring:!!master.recurrence};
 }
 async move(plan,key){
  if(this.env.GOOGLE_WRITE_ENABLED!=='true')throw Error('CALENDAR_WRITE_DISABLED');
  const current=await this.get(plan.event_id);
  if(current.extendedProperties?.private?.yookoo_operation===key)return current;
  if(plan.recurring&&(!current.recurringEventId||current.id===plan.master_id))throw Error('REFUSE_SERIES_CHANGE');
  if(current.etag!==plan.etag)throw Error('CALENDAR_CHANGED_REVIEW_AGAIN');
  return this.request('/'+encodeURIComponent(current.id),{method:'PATCH',headers:{'If-Match':current.etag},body:JSON.stringify({start:{dateTime:`${plan.date}T${plan.start}:00+07:00`,timeZone:TZ},end:{dateTime:`${plan.date}T${plan.end}:00+07:00`,timeZone:TZ},extendedProperties:{private:{...current.extendedProperties?.private,yookoo_operation:key}}})});
 }
 async create(plan,key){
  if(this.env.GOOGLE_WRITE_ENABLED!=='true')throw Error('CALENDAR_WRITE_DISABLED');
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(this.calendarId+':'+key));const id='cafe'+Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
  try{const old=await this.get(id);if(old.extendedProperties?.private?.yookoo_operation!==key)throw Error('ID_CONFLICT');return old;}catch(e){if(e.status!==404)throw e;}
  const same=(await this.list(plan.date)).find(e=>e.summary===plan.title&&Date.parse(e.start?.dateTime)===Date.parse(`${plan.date}T${plan.start}:00+07:00`));
  if(same)throw Error('CALENDAR_DUPLICATE_FOUND');
  const body={id,summary:plan.title,start:{dateTime:`${plan.date}T${plan.start}:00+07:00`,timeZone:TZ},end:{dateTime:`${plan.date}T${plan.end}:00+07:00`,timeZone:TZ},extendedProperties:{private:{yookoo_operation:key}},reminders:{useDefault:false,overrides:[{method:'popup',minutes:15}]}};
  try{return await this.request('',{method:'POST',body:JSON.stringify(body)});}catch(e){if(e.status===409){const found=await this.get(id);if(found.extendedProperties?.private?.yookoo_operation===key)return found;}throw e;}
 }
}
export function conflicts(items,start,end){return items.filter(e=>e.status!=='cancelled'&&Date.parse(e.start?.dateTime||e.start?.date)<Date.parse(end)&&Date.parse(e.end?.dateTime||e.end?.date)>Date.parse(start));}
