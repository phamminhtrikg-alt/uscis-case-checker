import worker,{SecretaryCoordinator} from '../worker.js';
const kvMap=new Map();
export class RuntimeCoordinator extends SecretaryCoordinator {
 constructor(ctx,env){super(ctx,{...env,YOOKOO_KV:{async get(k){return kvMap.has(k)?JSON.parse(kvMap.get(k)):null;},async put(k,v){kvMap.set(k,v);}}});}
}
export default {async test(controller,env){
 const base={TELEGRAM_BOT_TOKEN:'runtime-only',TELEGRAM_CHAT_ID:'1',SECRETARY_MODE:'live',YOOKOO_KV:{},SECRETARY_COORDINATOR:env.COORD};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(base.TELEGRAM_BOT_TOKEN));const sec=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
 function req(id,text){return new Request('https://x/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':sec},body:JSON.stringify({update_id:id,message:{chat:{id:1},from:{id:1},text}})});}
 for(const [id,text] of [[1,'/tasks'],[2,'Đã xong Km3+665'],[3,'/confirm p2'],[4,'/task W09'],[5,'/calendar'],[6,'/check']]){const r=await worker.fetch(req(id,text),base);if(!r.ok)throw Error('Failed command '+text);}
 await Promise.all([worker.fetch(req(7,'/daily'),base),worker.fetch(req(7,'/daily'),base)]);
 const result=await(await fetch('https://controls.test/stats')).json();
 if(result.count!==8||!result.confirmed||!result.road)throw Error('Runtime failed '+JSON.stringify(result));
 console.log('PASS actual Durable Object storage + KV adapter, concurrent retry, confirmation, legacy /check with road, calendar offline');
}};
