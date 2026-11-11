export class Meta{constructor(){this.map=new Map();}async get(k){return structuredClone(this.map.get(k));}async put(k,v){this.map.set(k,structuredClone(v));}async delete(k){this.map.delete(k);}async transaction(fn){return fn(this);}}
export class KV{constructor(){this.map=new Map();this.writes=[];}async get(k){return this.map.has(k)?JSON.parse(this.map.get(k)):null;}async put(k,v){this.writes.push(k);this.map.set(k,v);}}
export const now=new Date('2026-11-11T12:10:00+07:00');
