import legacy from './legacy.js';
import {Journal,once} from './store.js';
import {processText,calendarContext} from './engine.js';
import {Calendar} from './calendar.js';
import {local,due,report,localReminders} from './model.js';
import {mcpFetch} from './mcp.js';
const OLD_COMMANDS=new Set(['/test','/check','/detail','/f4','/case','/road','/news','/health']);
async function secret(token){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function sendText(env,text){const ids=[];while(text.length){let end=Math.min(3800,text.length);if(end<text.length){const n=text.lastIndexOf('\n',end-1);if(n>0)end=n+1;}const part=text.slice(0,end);text=text.slice(end);const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:part,disable_web_page_preview:true}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('TELEGRAM_FAILED');const d=await r.json();if(!d.ok)throw Error('TELEGRAM_FAILED');ids.push(d.result?.message_id||null);}return ids;}
function safeMessage(e){const msg=String(e?.message||'');if(/STALE/.test(msg))return 'Dữ liệu mục này đã thay đổi. Hãy gửi lại đề xuất theo trạng thái mới.';if(/CALENDAR/.test(msg))return 'Không hoàn tất kết nối/ghi Calendar. Kiểm tra quyền và trạng thái lịch rồi thử lại; tôi chưa báo đồng bộ thành công.';if(/INSTANCE|EVENT_|REFUSE_/.test(msg))return 'Không xác định được đúng một lần diễn ra của lịch; chưa sửa chuỗi.';if(/KV/.test(msg))return 'Kho dữ liệu chưa sẵn sàng; chưa xác nhận lưu cập nhật. Thử lại sau.';if(/AI/.test(msg))return 'Hội thoại AI tạm thời chưa trả lời được. Các lệnh công việc vẫn dùng được.';return 'Chưa hoàn tất yêu cầu. Dùng /history kiểm tra trước khi gửi lại.';}
export class SecretaryCoordinator {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.queue=Promise.resolve();this.store=new Journal(env.YOOKOO_KV,ctx.storage);this.calendar=new Calendar(env);}
 fetch(request){const run=this.queue.then(()=>this.handle(request));this.queue=run.catch(()=>{});return run;}
 async handle(request){
  const input=await request.json();
  if(input.kind==='tick'){
   const now=new Date(input.time);if(!Number.isFinite(now.getTime())||Math.abs(Date.now()-now.getTime())>300000)return Response.json({status:'STALE_TICK_SKIPPED'});
   const l=local(now),key=due(now);
   if(l.time==='08:30')await once(this.ctx.storage,'legacy:'+l.date,async()=>{await legacy.scheduled({},this.env,{});return 'legacy daily report';});
   if(key&&this.env.SECRETARY_REMINDERS==='true')await once(this.ctx.storage,'telegram:'+key,async()=>sendText(this.env,report(await this.store.load(),l.time,now)+await calendarContext(this.calendar,l.date)));
   if(this.env.SECRETARY_REMINDERS==='true'){for(const r of localReminders(await this.store.load(),now,this.env.PERSONAL_REMINDERS==='true'))await once(this.ctx.storage,'telegram:'+l.date+':'+r.id,()=>sendText(this.env,r.text));}
   return Response.json({status:'OK'});
  }
  const update=input.update,id=update?.update_id;if(!Number.isSafeInteger(id)||id<0)return new Response('Bad update',{status:400});
  const msg=update.message;if(!msg)return new Response('OK');
  const key='turn:'+id,old=await this.ctx.storage.get(key);
  if(old?.done)return new Response('OK');
  const text=String(msg.text||'').trim();if(!text)return new Response('OK');
  const cmd=text.split(/\s+/)[0].toLowerCase().split('@')[0];
  if(OLD_COMMANDS.has(cmd)){
   await once(this.ctx.storage,'legacy-update:'+id,async()=>{const r=await legacy.fetch(new Request('https://local/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':await secret(this.env.TELEGRAM_BOT_TOKEN)},body:JSON.stringify(update)}),this.env);if(!r.ok)throw Error('LEGACY_FAILURE');return r.status;});
   await this.ctx.storage.put(key,{done:true});return new Response('OK');
  }
  let answer=old?.answer;
  if(!answer){
   const minute=Math.floor(Date.now()/60000),counter=await this.ctx.storage.get('rate')||{minute,n:0};
   if(counter.minute===minute&&counter.n>=12)answer='Bạn đang gửi nhiều yêu cầu. Chờ một phút rồi gửi lại để tránh ghi trùng hoặc tốn lượt AI.';
   else {await this.ctx.storage.put('rate',{minute,n:counter.minute===minute?counter.n+1:1});try{answer=await processText(text.slice(0,4000),id,this.store,this.ctx.storage,this.calendar,this.env);}catch(e){answer=safeMessage(e);}}
   await this.ctx.storage.put(key,{answer,done:false});
  }
  const delivery=await once(this.ctx.storage,'reply:'+id,()=>sendText(this.env,answer));
  await this.ctx.storage.put(key,{done:true,delivery:delivery.status});return new Response('OK');
 }
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  const mcpResponse=await mcpFetch(request,env);if(mcpResponse)return mcpResponse;
  if(url.pathname==='/'&&request.method==='GET')return new Response('YOOKOO R9-SECRETARY · '+(env.SECRETARY_MODE==='live'?'live':'preview'));
  if(url.pathname!=='/telegram'||request.method!=='POST')return new Response('Not found',{status:404});
  if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)return new Response('Missing configuration',{status:503});
  if(request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==await secret(env.TELEGRAM_BOT_TOKEN))return new Response('Forbidden',{status:403});
  let update;try{update=await request.json();}catch{return new Response('Bad JSON',{status:400});}
  const msg=update.message;
  if(!msg)return new Response('OK');
  const allowedSender=String(env.TELEGRAM_ALLOWED_USER_ID||env.TELEGRAM_CHAT_ID);
  if(String(msg.chat?.id)!==String(env.TELEGRAM_CHAT_ID)||String(msg.from?.id)!==allowedSender)return new Response('OK');
  if(env.SECRETARY_MODE!=='live')return new Response('Preview only: production actions disabled',{status:503});
  if(!env.SECRETARY_COORDINATOR||!env.YOOKOO_KV)return new Response('Missing secretary binding',{status:503});
  return env.SECRETARY_COORDINATOR.get(env.SECRETARY_COORDINATOR.idFromName('owner:'+env.TELEGRAM_CHAT_ID)).fetch('https://internal/handle',{method:'POST',body:JSON.stringify({kind:'update',update})});
 },
 async scheduled(controller,env){
  if(env.SECRETARY_MODE!=='live'||!env.SECRETARY_COORDINATOR)return;
  const res=await env.SECRETARY_COORDINATOR.get(env.SECRETARY_COORDINATOR.idFromName('owner:'+env.TELEGRAM_CHAT_ID)).fetch('https://internal/tick',{method:'POST',body:JSON.stringify({kind:'tick',time:new Date(controller.scheduledTime).toISOString()})});
  if(!res.ok)throw Error('SECRETARY_TICK_FAILED');
 }
};
