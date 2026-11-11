import {seed,apply} from './model.js';
// Domain data stays in the existing KV. Durable Object storage holds only
// transaction intents, revision pointers and delivery/confirmation metadata.
export class Journal {
 constructor(kv,meta){this.kv=kv;this.meta=meta;this.cached=null;}
 async recover(){
  if(!this.kv)throw Error('KV_NOT_BOUND');
  const pending=await this.meta.get('pending');
  if(pending){
   await this.kv.put(pending.key,JSON.stringify(pending.event));
   await this.meta.transaction(async tx=>{const keys=await tx.get('events')||[];if(!keys.includes(pending.key))await tx.put('events',[...keys,pending.key]);await tx.delete('pending');});
   this.cached=null;
  }
 }
 async load(){
  await this.recover();if(this.cached)return structuredClone(this.cached);
  let s=seed();let checkpoint=await this.meta.get('checkpoint');
  if(!checkpoint&&!(await this.meta.get('events')||[]).length){checkpoint='secretary:v1:seed';await this.kv.put(checkpoint,JSON.stringify(s));await this.meta.put('checkpoint',checkpoint);this.cached=s;return structuredClone(s);}
  if(checkpoint){s=await this.kv.get(checkpoint,{type:'json'});if(!s)throw Error('KV_VISIBILITY_PENDING');}
  for(const key of await this.meta.get('events')||[]){const e=await this.kv.get(key,{type:'json'});if(!e)throw Error('KV_VISIBILITY_PENDING');apply(s,e);}
  this.cached=s;return structuredClone(s);
 }
 async append(event){
  const state=await this.load();const key='secretary:v1:event:'+event.id;
  const keys=await this.meta.get('events')||[];
  if(keys.includes(key)||state.history.some(e=>e.id===event.id))return state;
  apply(state,event); // Validate BEFORE the durable intent is persisted.
  await this.meta.put('pending',{key,event});
  await this.recover();this.cached=state;
  // Immutable checkpoints; archive event keys remain in KV. No legacy key touched.
  if((await this.meta.get('events')||[]).length>=100){
   const cp='secretary:v1:snapshot:'+state.revision;
   await this.kv.put(cp,JSON.stringify(state));
   await this.meta.transaction(async tx=>{await tx.put('checkpoint',cp);await tx.put('events',[]);});
  }
  return structuredClone(state);
 }
}
export async function once(meta,id,send){
 const key='delivery:'+id,old=await meta.get(key);
 if(old)return old; // Unknown outcome is not retried silently.
 await meta.put(key,{status:'SENDING',at:new Date().toISOString()});
 try{const result=await send();const receipt={status:'SENT',at:new Date().toISOString(),result};await meta.put(key,receipt);return receipt;}
 catch {const receipt={status:'UNKNOWN',at:new Date().toISOString()};await meta.put(key,receipt);return receipt;}
}
