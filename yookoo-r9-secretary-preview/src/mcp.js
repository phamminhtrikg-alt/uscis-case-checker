const MCP_PROTOCOL='2025-06-18';
const MCP_SCOPE='mcp:read mcp:write';
function mcpJson(value,status=200,extra={}){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}});}
function baseUrl(request){return new URL(request.url).origin;}
function bytes(n=24){const a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a).map(x=>x.toString(16).padStart(2,'0')).join('');}
function b64(bytesValue){let s='';for(const x of bytesValue)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function pkce(value){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return b64(new Uint8Array(d));}
function html(s){return String(s).replace(/[&<>\"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[x]));}
function authHeader(env){return env.MCP_AUTH_MODE==='preview-open'?'':String(env.MCP_ADMIN_SECRET||'');}
async function validBearer(request,env){
  if(env.MCP_AUTH_MODE==='preview-open')return true;
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!token||!env.YOOKOO_DB)return false;
  try{const row=await env.YOOKOO_DB.prepare('SELECT access_token,expires_at FROM oauth_tokens WHERE access_token=?1').bind(token).first();return !!row&&Number(row.expires_at)>Date.now();}catch{return false;}
}
function protectedMeta(request){const base=baseUrl(request);return {resource:base+'/mcp',authorization_servers:[base],scopes_supported:MCP_SCOPE.split(' '),bearer_methods_supported:['header']};}
function authMeta(request){const base=baseUrl(request);return {issuer:base,authorization_endpoint:base+'/oauth/authorize',token_endpoint:base+'/oauth/token',registration_endpoint:base+'/oauth/register',scopes_supported:MCP_SCOPE.split(' '),response_types_supported:['code'],grant_types_supported:['authorization_code'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none','client_secret_post']};}
async function registerClient(request,env){
  let body={};try{body=await request.json();}catch{return mcpJson({error:'invalid_client_metadata'},400);}
  const redirects=Array.isArray(body.redirect_uris)?body.redirect_uris.filter(x=>typeof x==='string'&&x.length<1000):[];
  if(!redirects.length||!env.YOOKOO_DB)return mcpJson({error:'invalid_redirect_uris'},400);
  const clientId='client_'+bytes(12),secret=bytes(24);
  await env.YOOKOO_DB.prepare('INSERT INTO oauth_clients(client_id,client_secret,redirect_uris,created_at) VALUES(?1,?2,?3,?4)').bind(clientId,secret,JSON.stringify(redirects),new Date().toISOString()).run();
  return mcpJson({client_id:clientId,client_secret:secret,redirect_uris:redirects,token_endpoint_auth_method:'client_secret_post'},201);
}
async function authorize(request,env){
  const u=new URL(request.url),p=u.searchParams,params={client_id:p.get('client_id')||'',redirect_uri:p.get('redirect_uri')||'',response_type:p.get('response_type')||'',state:p.get('state')||'',code_challenge:p.get('code_challenge')||'',scope:p.get('scope')||MCP_SCOPE};
  if(request.method==='GET'){
    return new Response('<!doctype html><meta charset="utf-8"><title>YOOKOO MCP authorization</title><h1>Authorize YOOKOO MCP preview</h1><p>Nhập MCP_ADMIN_SECRET đã cấu hình trong Cloudflare để cấp quyền cho phiên ChatGPT này.</p><form method="post">'+Object.entries(params).map(([k,v])=>'<input type="hidden" name="'+html(k)+'" value="'+html(v)+'">').join('')+'<label>MCP_ADMIN_SECRET <input name="admin_secret" type="password" autocomplete="off" required></label><button type="submit">Authorize</button></form>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  }
  if(env.MCP_AUTH_MODE!=='preview-open'){
    if(!env.MCP_ADMIN_SECRET||String((await request.formData()).get('admin_secret')||'')!==env.MCP_ADMIN_SECRET)return new Response('Authorization failed',{status:403});
  }
  if(params.response_type!=='code'||!params.client_id||!params.redirect_uri||!env.YOOKOO_DB)return new Response('Invalid authorization request',{status:400});
  const client=await env.YOOKOO_DB.prepare('SELECT redirect_uris FROM oauth_clients WHERE client_id=?1').bind(params.client_id).first();
  if(!client||!JSON.parse(client.redirect_uris).includes(params.redirect_uri))return new Response('Invalid client or redirect URI',{status:400});
  const code=bytes(24),expires=Date.now()+300000;
  await env.YOOKOO_DB.prepare('INSERT INTO oauth_codes(code,client_id,redirect_uri,code_challenge,expires_at) VALUES(?1,?2,?3,?4,?5)').bind(code,params.client_id,params.redirect_uri,params.code_challenge||null,expires).run();
  const target=new URL(params.redirect_uri);target.searchParams.set('code',code);if(params.state)target.searchParams.set('state',params.state);
  return Response.redirect(target.toString(),302);
}
async function token(request,env){
  if(!env.YOOKOO_DB)return mcpJson({error:'temporarily_unavailable'},503);
  const f=await request.formData(),code=String(f.get('code')||''),clientId=String(f.get('client_id')||''),redirect=String(f.get('redirect_uri')||''),verifier=String(f.get('code_verifier')||'');
  const row=await env.YOOKOO_DB.prepare('SELECT * FROM oauth_codes WHERE code=?1 AND used=0').bind(code).first();
  if(!row||Number(row.expires_at)<=Date.now()||row.client_id!==clientId||row.redirect_uri!==redirect)return mcpJson({error:'invalid_grant'},400);
  if(row.code_challenge&&(!verifier||await pkce(verifier)!==row.code_challenge))return mcpJson({error:'invalid_grant'},400);
  await env.YOOKOO_DB.prepare('UPDATE oauth_codes SET used=1 WHERE code=?1').bind(code).run();
  const access=bytes(32),expires=Date.now()+3600000;
  await env.YOOKOO_DB.prepare('INSERT INTO oauth_tokens(access_token,client_id,expires_at) VALUES(?1,?2,?3)').bind(access,clientId,expires).run();
  return mcpJson({access_token:access,token_type:'Bearer',expires_in:3600,scope:MCP_SCOPE});
}
function toolList(){return [{name:'get_daily_status',description:'Đọc trạng thái tổng hợp mới nhất của YOOKOO; không ghi dữ liệu.',inputSchema:{type:'object',properties:{},additionalProperties:false}},{name:'get_work_progress',description:'Đọc tiến độ một nhóm việc hoặc toàn bộ snapshot.',inputSchema:{type:'object',properties:{task_id:{type:'string'}},additionalProperties:false}},{name:'get_change_history',description:'Đọc lịch sử cập nhật đã ghi.',inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}},{name:'update_work_progress',description:'Đề xuất cập nhật tiến độ; preview luôn trả read-only cho tới khi bật quyền ghi.',inputSchema:{type:'object',properties:{task_id:{type:'string'},expected_version:{type:'integer'},status:{type:'string'},note:{type:'string'}},required:['task_id','expected_version','status'],additionalProperties:false}},{name:'send_telegram_notice',description:'Gửi thông báo Telegram chỉ khi bật MCP_NOTICE_ENABLED và cấu hình bot thử nghiệm.',inputSchema:{type:'object',properties:{text:{type:'string',maxLength:3800},dedupe_key:{type:'string',maxLength:200}},required:['text','dedupe_key'],additionalProperties:false}}];}
function resultText(value){return {content:[{type:'text',text:JSON.stringify(value,null,2)}],structuredContent:value};}
async function callTool(name,args,env){
  const state=seed();
  if(name==='get_daily_status')return resultText({mode:env.SECRETARY_MODE||'preview',preview:true,uscis:'manual record only; no online USCIS request',f4:'legacy module retained',road:'legacy module retained',revision:state.revision,task_count:Object.keys(state.tasks).length,open_tasks:Object.values(state.tasks).filter(x=>['IN_PROGRESS','NOT_STARTED'].includes(x.work_state)).map(x=>x.id)});
  if(name==='get_work_progress'){const items=args?.task_id?[state.tasks[args.task_id]].filter(Boolean):Object.values(state.tasks);return resultText({mode:'preview',revision:state.revision,tasks:items});}
  if(name==='get_change_history')return resultText({mode:'preview',revision:state.revision,history:state.history.slice(-(Number(args?.limit)||20))});
  if(name==='update_work_progress')return resultText({ok:false,mode:'preview',error:'PREVIEW_READ_ONLY',message:'Bản preview chưa bật quyền ghi. Dùng update_work_progress sau khi cấu hình quyền và duyệt CP-MCP-01.'});
  if(name==='send_telegram_notice')return resultText({ok:false,mode:'preview',error:'NOTICE_DISABLED',message:'Preview không gửi Telegram và chưa dùng bot production.'});
  throw new Error('Unknown tool');
}
async function mcp(request,env){
  if(!(await validBearer(request,env)))return mcpJson({jsonrpc:'2.0',error:{code:-32001,message:'Unauthorized'}},401,{'WWW-Authenticate':'Bearer resource_metadata="'+baseUrl(request)+'/.well-known/oauth-protected-resource"'});
  let body;try{body=await request.json();}catch{return mcpJson({jsonrpc:'2.0',error:{code:-32700,message:'Parse error'}},400);}
  const id=body.id??null,method=body.method;
  if(method==='initialize')return mcpJson({jsonrpc:'2.0',id,result:{protocolVersion:MCP_PROTOCOL,capabilities:{tools:{listChanged:false}},serverInfo:{name:'yookoo-daily-mcp-preview',version:'0.1.0'}}});
  if(method==='notifications/initialized')return new Response(null,{status:202});
  if(method==='tools/list')return mcpJson({jsonrpc:'2.0',id,result:{tools:toolList()}});
  if(method==='tools/call'){try{return mcpJson({jsonrpc:'2.0',id,result:await callTool(body.params?.name,body.params?.arguments||{},env)});}catch(e){return mcpJson({jsonrpc:'2.0',id,error:{code:-32602,message:String(e.message||e)}},400);}}
  return mcpJson({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}},404);
}
export async function mcpFetch(request,env){
  const u=new URL(request.url);
  if(u.pathname==='/.well-known/oauth-protected-resource'&&request.method==='GET')return mcpJson(protectedMeta(request));
  if(u.pathname==='/.well-known/oauth-authorization-server'&&request.method==='GET')return mcpJson(authMeta(request));
  if(u.pathname==='/oauth/register'&&request.method==='POST')return registerClient(request,env);
  if(u.pathname==='/oauth/authorize'&&(request.method==='GET'||request.method==='POST'))return authorize(request,env);
  if(u.pathname==='/oauth/token'&&request.method==='POST')return token(request,env);
  if(u.pathname==='/mcp'&&request.method==='POST')return mcp(request,env);
  if(u.pathname==='/mcp'&&request.method==='GET')return new Response('Use POST for MCP Streamable HTTP',{status:405,headers:{Allow:'POST'}});
  return null;
}
