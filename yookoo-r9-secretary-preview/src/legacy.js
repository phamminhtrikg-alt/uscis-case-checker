// YOOKOO Daily Bot CP02-D-R8-TEXT - Cloudflare Workers (module format)
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// Existing cron: 30 1 * * * (08:30 Asia/Ho_Chi_Minh)
const PRIORITY = '2014-04-03';
const VISA_JSON = 'https://raw.githubusercontent.com/armanckeser/visa-bulletin-data/main/data/latest.json';
const VISA_JSON_2 = 'https://www.greencardwait.com/feed/v1/latest.json';
// Third-party sources may copy the same upstream; agreement does not prove independence.
const VISA_HOME = 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html';
const VERIFIED = {
  month: '2026-11', a: '2012-10-22', b: '2012-11-01',
  source: 'https://travel.state.gov/content/dam/visas/Bulletins/visabulletin_November2026.pdf',
  label: 'Mốc nền đã đối chiếu tài liệu chính thức 10/11/2026 (KHÔNG phải dữ liệu đọc mới)'
};
// Những mốc nền đã đối chiếu trước đây, KHÔNG phải trạng thái cập nhật trực tiếp.
const ROAD_BASE = {
  name: 'Đường nối tuyến tránh QL1 với Vành đai 2, đoạn Vành đai 2 - Hoàng Văn Thụ, phường Tân Thành, Cà Mau',
  length: '2,83 km', width: '40 m theo chủ trương',
  owner: 'Ban QLDA xây dựng công trình giao thông tỉnh Cà Mau',
  period: '2026–2029',
  capital: 'hơn 487 tỷ đồng (điều chỉnh, công bố 20/09/2026)',
  compensation: 'hơn 138,5 tỷ đồng (bồi thường, hỗ trợ, tái định cư theo tin 20/09/2026)',
  land: 'Chưa có tỷ lệ bàn giao mặt bằng được kiểm chứng',
  construction: 'Chưa xác minh được nhà thầu xây lắp hoặc ngày khởi công',
  milestones: [
    ['11/03/2026','Phê duyệt chủ trương đầu tư, QĐ 661/QĐ-UBND'],
    ['17/07/2026','Công bố KHLCNT chuẩn bị đầu tư bổ sung, PL2600064060-02'],
    ['20/09/2026','Tin công bố điều chỉnh vốn lên hơn 487 tỷ đồng']
  ],
  sources: [
    'https://baodauthau.vn/ca-mau-414-ty-dong-xay-duong-noi-tuyen-tranh-quoc-lo-1-voi-duong-vanh-dai-2-post195258.html',
    'https://dauthau.asia/kehoach/luachon-nhathau/ke-hoach-lua-chon-nha-thau-buoc-chuan-bi-dau-tu-bo-sung-lan-1-du-an-dau-tu-duong-noi-tuyen-tranh-quoc-lo-1-voi-2419416.html',
    'https://baoxaydung.vn/ca-mau-dieu-chinh-du-an-duong-noi-hon-487-ty-dong-tai-phuong-tan-thanh-192260920111401243.htm'
  ]
};
// Theo dõi nhiều cách gọi để giảm bỏ sót thông tin mới.
const ROAD_QUERIES = [
  '"đường nối tuyến tránh quốc lộ 1" "vành đai 2" "cà mau"',
  '"hoàng văn thụ" "vành đai 2" "tân thành"',
  '"PL2600064060"',
  '"đường nối tuyến tránh" "cà mau" đấu thầu khởi công'
];
const ROAD_FEEDS = ROAD_QUERIES.flatMap(q => [
  'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=vi&gl=VN&ceid=VN:vi',
  'https://www.bing.com/news/search?q=' + encodeURIComponent(q) + '&format=rss'
]);
const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const ESC = s => String(s ?? '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/<[^>]+>/g,'').trim();
// Schema adapters are pinned to the captured fixtures in evidence/.
const VISA_API = 'https://api.github.com/repos/armanckeser/visa-bulletin-data/contents/data/latest.json?ref=main';
const VISA_CACHE = 'visa_f4_snapshot_v1';
function validMonth(s) { return /^20\d{2}-(0[1-9]|1[0-2])$/.test(String(s)); }
function iso(s) {
  s=String(s ?? '').trim().toUpperCase();
  if(s==='C'||s==='U')return s;
  const m=s.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  if(m && MON.includes(m[2]))s=`20${m[3]}-${String(MON.indexOf(m[2])+1).padStart(2,'0')}-${m[1]}`;
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(s))return null;
  const d=new Date(s+'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===s ? s : null;
}
function dmy(s) { return s==='C'?'C (Current)':s==='U'?'U (Unavailable)':iso(s)?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:'Chưa rõ'; }
function monthNow(now=new Date()) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}`;
}
function vnNow() {return new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false});}
async function getText(url, ms=11000) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
  try {
    const r=await fetch(url,{headers:{Accept:url===VISA_API?'application/vnd.github.raw+json':'text/html,application/json,application/rss+xml;q=0.9,*/*;q=0.5','User-Agent':'YOOKOO-Daily-Bot/CP02-D-R8-TEXT'},signal:controller.signal,redirect:'follow'});
    if(!r.ok) { const e=new Error(`HTTP ${r.status}`);e.status=r.status;throw e; }
    return await r.text();
  } finally {clearTimeout(timer);}
}
function cutoff(row) {
  if(row?.status==='current')return 'C';
  if(row?.status==='unavailable')return 'U';
  return iso(row?.date ?? row?.cutoff_date ?? row?.value);
}
function parseGitHubVisa(data) {
  if(!validMonth(data?.bulletin)||!Array.isArray(data.rows))throw new Error('SCHEMA: GitHub rows-v1');
  const rows=data.rows.filter(x=>x?.category==='F4'&&x.country==='ROW'&&x.kind==='family');
  const read=chart=>{
    const r=rows.filter(x=>x.chart===chart);
    if(r.length!==1||r[0].bulletin&&r[0].bulletin!==data.bulletin)throw new Error('SCHEMA: F4 ROW trùng/thiếu/sai tháng');
    return cutoff(r[0]);
  };
  const a=read('final_action'),b=read('dates_for_filing');
  if(!a||!b)throw new Error('SCHEMA: F4 A/B sai ngày');
  return {month:data.bulletin,a,b,source:VISA_JSON,schema:'github-rows-v1'};
}
function parseGreenCardWait(data) {
  // Legacy adapter; no claim this endpoint is currently accessible.
  if(!validMonth(data?.bulletin))throw new Error('SCHEMA: GreenCardWait legacy-v1');
  const a=iso(data.final_action?.f4?.worldwide ?? data.final_action?.F4?.ROW ?? data.final_action?.F4?.worldwide);
  const b=iso(data.filing?.f4?.worldwide ?? data.filing?.F4?.ROW ?? data.filing?.F4?.worldwide);
  if(!a||!b)throw new Error('SCHEMA: GreenCardWait thiếu F4 A/B');
  return {month:data.bulletin,a,b,source:VISA_JSON_2,schema:'greencardwait-legacy-v1'};
}
function safeError(e) {
  if(e?.status)return `HTTP ${e.status}`;
  if(e?.name==='AbortError'||e?.name==='TimeoutError')return 'TIMEOUT';
  if(e instanceof SyntaxError)return 'INVALID_JSON';
  if(String(e?.message).startsWith('SCHEMA:'))return e.message;
  return 'NETWORK_OR_PARSE_ERROR'; // Never echo arbitrary exceptions/credentials.
}
async function visaStatus(env={},writeCache=false,now=new Date()) {
  const checkedAt=now.toISOString(),month=monthNow(now),diagnostics=[];
  const stamp=()=>new Date().toISOString();
  async function probe(name,url,parser) {
    try {
      const data=parser(await getText(url,5000));
      diagnostics.push({name,url,status:'OK',month:data.month,checkedAt:stamp()});
      return {...data,readAt:checkedAt,verified:false,origin:'mirror',transport:url};
    } catch(e) {diagnostics.push({name,url,status:safeError(e),checkedAt:stamp()});return null;}
  }
  async function github() {
    let result=await probe('GitHub raw',VISA_JSON,text=>parseGitHubVisa(JSON.parse(text)));
    // Same publisher, alternate public transport; NOT an independent confirmation.
    if(!result)result=await probe('GitHub API',VISA_API,text=>parseGitHubVisa(JSON.parse(text)));
    return result;
  }
  async function cached() {
    if(!env.YOOKOO_KV)return null;
    try {
      const x=await env.YOOKOO_KV.get(VISA_CACHE,{type:'json'});
      if(!x)return null;
      if(x.version!==1||!validMonth(x.month)||!iso(x.a)||!iso(x.b)||!Number.isFinite(Date.parse(x.readAt))||Date.parse(x.readAt)>now.getTime()+60000||![VISA_JSON,VISA_JSON_2].includes(x.source)&&!/^https:\/\/travel\.state\.gov\//.test(x.source))throw new Error('invalid cache');
      return {...x,verified:false,wasVerified:x.verified===true,origin:'cache'};
    } catch {diagnostics.push({name:'KV read',status:'CACHE_INVALID_OR_UNAVAILABLE',checkedAt:stamp()});return null;}
  }
  const [mirror,cache]=await Promise.all([github(),cached()]);
  const live=[mirror].filter(Boolean);
  const candidates=[...live,...(cache?[cache]:[])];
  const maxMonth=nextMonth(month);
  for(const x of candidates)if(x.month>maxMonth)diagnostics.push({name:x.origin,status:'FUTURE_MONTH_REJECTED',month:x.month,checkedAt});
  // A newer cached month wins over older network responses. Cutoff dates may legitimately retrogress.
  const eligible=candidates.filter(x=>x.month<=maxMonth&&x.month>=VERIFIED.month);
  eligible.sort((a,b)=>b.month.localeCompare(a.month)||Number(b.verified)-Number(a.verified)||Number(a.origin==='cache')-Number(b.origin==='cache'));
  let best=eligible[0];
  let conflict=false;
  if(best) {
    const same=live.filter(x=>x.month===best.month);
    conflict=same.some(x=>x.a!==best.a||x.b!==best.b);
    if(conflict&&!best.verified) {
      const stable=cache&&cache.month===best.month?cache:null;
      best=stable||{...VERIFIED,origin:'baseline',verified:false,readAt:null};
    }
  }
  best=best||{...VERIFIED,origin:'baseline',verified:false,readAt:null};
  const result={...best,checkedAt,diagnostics,conflict,unofficial:best.origin==='mirror'||best.origin==='cache'&&!best.wasVerified,
    upcoming:best.month>month,stale:best.month<month,fresh:best.origin==='official'||best.origin==='mirror'};
  if(writeCache&&env.YOOKOO_KV&&result.fresh&&(!conflict||result.verified)) {
    try {
      const snapshot={version:1,month:result.month,a:result.a,b:result.b,source:result.source,transport:result.transport,schema:result.schema,readAt:result.readAt,verified:result.verified};
      // Limit unnecessary writes on unchanged snapshots to once per hour.
      if(!cache||cache.month!==snapshot.month||cache.a!==snapshot.a||cache.b!==snapshot.b||cache.wasVerified!==snapshot.verified||now.getTime()-Date.parse(cache.readAt)>3600000)
        await env.YOOKOO_KV.put(VISA_CACHE,JSON.stringify(snapshot));
    } catch {diagnostics.push({name:'KV write',status:'CACHE_WRITE_FAILED',checkedAt:stamp()});}
  }
  result.error=diagnostics.filter(x=>x.status!=='OK').map(x=>`${x.name}: ${x.status}`).join('; ');
  return result;
}
function visaLabel(v) {
  if(v.origin==='baseline')return 'MỐC CŨ – chưa xác minh bản hiện hành';
  if(v.origin==='cache')return `BẢN LƯU – chưa đọc mới${v.stale?'; quá tháng':''}`;
  return v.stale?'DỮ LIỆU QUÁ THÁNG':'';
}
function priorityStatus(v,key) {
  if(!v.fresh||v.stale||v.conflict)return `${key}: chưa kết luận theo bản hiện hành`;
  const value=v[key.toLowerCase()];
  const label=value==='U'?'U – chưa cấp số visa':value==='C'?'C – không giới hạn ngày ưu tiên':PRIORITY<value?'ngày ưu tiên sớm hơn mốc':'chưa tới ngày ưu tiên';
  return `${key}: ${label}${v.verified?'':' (tham khảo)'}`;
}
const VISA_DELIVERED = 'visa_f4_delivered_v1';
function nextMonth(month) {
  const [y,m]=month.split('-').map(Number);
  return `${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,'0')}`;
}
function monthLabel(month) {const [y,m]=month.split('-');return `${m}/${y}`;}
function dayDifference(later,earlier) {
  if(!iso(later)||!iso(earlier)||['C','U'].includes(later)||['C','U'].includes(earlier))return null;
  return Math.round((Date.parse(later+'T00:00:00Z')-Date.parse(earlier+'T00:00:00Z'))/86400000);
}
function gapText(cutoff) {
  if(cutoff==='C')return 'C — Current; không có mốc ngày để tính khoảng cách';
  if(cutoff==='U')return 'U — Unavailable; không có số ngày để tính';
  const d=dayDifference(PRIORITY,cutoff);
  if(d===null)return 'chưa đủ dữ liệu để tính';
  if(d>0)return `mốc còn cách ngày ưu tiên ${d} ngày`;
  if(d===0)return 'trùng ngày ưu tiên; chưa vượt mốc (phải sớm hơn cutoff)';
  return `mốc đã vượt ngày ưu tiên ${-d} ngày`;
}
function cutoffLines(v) {
  return `A ${dmy(v.a)} · ${gapText(v.a)}\nB ${dmy(v.b)} · ${gapText(v.b)}\n`;
}
function visaSummary(v) {
  return `✈️ F4 ${monthLabel(v.month)}${v.upcoming?' — cho tháng tới':''}\n${visaLabel(v)?visaLabel(v)+'\n':''}Ngày ưu tiên: ${dmy(PRIORITY)}\n${cutoffLines(v)}Khoảng cách mốc ngày, không phải số ngày chờ visa.\n`;
}
async function readDelivered(env) {
  if(!env.YOOKOO_KV)return null;
  try {
    const x=await env.YOOKOO_KV.get(VISA_DELIVERED,{type:'json'});
    return x?.version===1&&validMonth(x.month)&&iso(x.a)&&iso(x.b)?x:null;
  } catch {return null;}
}
async function prepareVisaNotice(v,env) {
  const previous=await readDelivered(env);
  const base=previous||VERIFIED;
  let kind=null;
  if(v.fresh&&!v.stale&&!v.conflict) {
    if(v.month>base.month)kind='new-month';
    else if(v.month===base.month&&(v.a!==base.a||v.b!==base.b))kind='revision';
  }
  return {kind,previous};
}
function visaNotice(v,notice) {
  if(!notice?.kind)return '';
  let s=notice.kind==='new-month'?`🚨🚨 CÓ LỊCH CHIẾU KHÁN MỚI — ${monthLabel(v.month)}\n`:`🔔 LỊCH ${monthLabel(v.month)} CÓ ĐIỀU CHỈNH A/B\n`;
  s+='Phát hiện từ nguồn GitHub; chưa đối chiếu chính thức.\n';
  if(v.upcoming)s+='🗓️ Bulletin cho tháng tới, chưa phải tháng đang áp dụng.\n';
  if(notice.previous) {
    const parts=['a','b'].map(key=>{
      const d=dayDifference(v[key],notice.previous[key]);
      return d===null?`${key.toUpperCase()}: ${dmy(notice.previous[key])} → ${dmy(v[key])}`:`${key.toUpperCase()} ${d>0?'tiến '+d:d<0?'lùi '+(-d):'không đổi'}${d===0?'':' ngày'}`;
    });
    s+=`So bản ${monthLabel(notice.previous.month)} đã gửi: ${parts.join(' | ')}\n`;
  }
  return s+'\n';
}
async function recordVisaDelivery(v,env,notice) {
  if(!env.YOOKOO_KV||!v.fresh||v.stale||v.conflict)return;
  if(notice.previous&&notice.previous.month>v.month)return;
  if(notice.previous&&notice.previous.month===v.month&&notice.previous.a===v.a&&notice.previous.b===v.b)return;
  try {
    await env.YOOKOO_KV.put(VISA_DELIVERED,JSON.stringify({version:1,month:v.month,a:v.a,b:v.b,sentAt:new Date().toISOString(),priorityDate:PRIORITY}));
  } catch {console.warn('Visa delivery state could not be saved');}
}
async function sendVisaReport(env,chatId,v,message) {
  const notice=await prepareVisaNotice(v,env);
  await telegram(env,chatId,(visaNotice(v,notice)+message).slice(0,3900));
  // Mark only after Telegram acknowledges delivery. Source snapshots do not consume alerts.
  await recordVisaDelivery(v,env,notice);
}
function f4Message(v,details=false) {
  let s=`YOOKOO | ${vnNow()} (VN)\n${visaSummary(v)}Nguồn: ${v.source}\n`;
  if(details)s+=`Kiểm tra: ${v.checkedAt}\nLần đọc thành công: ${v.readAt||'chưa có'}\n`+v.diagnostics.map(x=>`• ${x.name}: ${x.status} | ${x.checkedAt}`).join('\n');
  return s;
}
// Static record supplied by the user. No USCIS requests or API integration.
const CASE_RECEIPT='IOE8434753880';
const CASE_OLD_RECEIPT='EAC1490165690';
const CASE_HOME='https://egov.uscis.gov/';
const CASE_BASE={receipt:CASE_RECEIPT,title:'Case Was Received Receipt Notice Not Sent',eventDate:'2025-04-03',suppliedOn:'2026-11-11',origin:'user-screenshot'};
async function caseStatus() {return {...CASE_BASE};}
function caseMessage(c,details=false) {
  let s=`📂 I-130 — TRẠNG THÁI ĐÃ GHI NHẬN\nMã hiện tại: ${CASE_RECEIPT}\nMã cũ: ${CASE_OLD_RECEIPT}\n${c.title}\nNgày sự kiện: ${dmy(c.eventDate)}\nUSCIS đã tiếp nhận vào hệ thống; tiêu đề ghi chưa gửi thông báo nhận hồ sơ.\n🔎 Tự tra cứu: ${CASE_HOME}\nNhập mã ${CASE_RECEIPT}.\n`;
  if(details)s+='Nội dung ảnh ghi tại thời điểm thông báo không có yêu cầu còn chờ; USCIS sẽ gửi thư nếu cần bổ sung. Thông báo này chưa xác nhận I-130 được chấp thuận.\n';
  return s;
}

function plain(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
}
function roadScore(title) {
  const t=plain(title);
  let score=0;
  if(t.includes('ca mau'))score+=2;
  if(t.includes('vanh dai 2'))score+=3;
  if(t.includes('quoc lo 1')||t.includes('tuyen tranh'))score+=3;
  if(t.includes('hoang van thu'))score+=3;
  if(t.includes('tan thanh'))score+=2;
  if(t.includes('pl2600064060'))score+=6;
  const route = t.includes('vanh dai 2') && (t.includes('quoc lo 1') || t.includes('tuyen tranh') || t.includes('hoang van thu'));
  const region = t.includes('ca mau') || t.includes('tan thanh');
  const projectSpecific = t.includes('pl2600064060') || (route && region) || (t.includes('duong noi tuyen tranh') && t.includes('ca mau'));
  return projectSpecific ? score : 0;
}
function rssItems(xml, feedName="Nguồn RSS") {
  const out=[];
  for(const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const body=m[1];
    const title=ESC(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).replace(/^<!\[CDATA\[|\]\]>$/g,'');
    const link=ESC(body.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]);
    const pub=ESC(body.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]);
    const published=new Date(pub);
    if(!title||!/^https:\/\//i.test(link)||Number.isNaN(published.getTime()))continue;
    if(Date.now()-published.getTime()>90*86400000 || published.getTime()>Date.now()+86400000)continue;
    if(roadScore(title)<5)continue;
    const publisher=ESC(body.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i)?.[1]) || feedName;
    out.push({title,link,date:published.toISOString().slice(0,10),score:roadScore(title),publisher,feedName,seen:false});
  }
  return out;
}
async function roadStatus(env,writeSeen=true) {
  const results=await Promise.allSettled(ROAD_FEEDS.map(x=>getText(x,9000)));
  const found=[]; const errors=[];
  for(const [idx,result] of results.entries()){
    if(result.status==='fulfilled'){
      if(!/<rss[\s>]/i.test(result.value)) {errors.push('Phản hồi không phải RSS');continue;}
      const feedName=ROAD_FEEDS[idx].includes("news.google.com") ? "Google News" : "Bing News";
      found.push(...rssItems(result.value,feedName));
    } else errors.push(String(result.reason?.message||result.reason).slice(0,80));
  }
  const unique=new Map();
  for(const item of found){
    const key=plain(item.title).replace(/[^a-z0-9]/g,'').slice(0,100);
    const old=unique.get(key);
    if(!old || item.score>old.score)unique.set(key,item);
  }
  const candidates=[...unique.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.score-a.score).slice(0,12);
  const checked=results.some(x=>x.status==='fulfilled' && /<rss[\s>]/i.test(x.value));
  let newItems=candidates.slice(0,3), hasComparison=false;
  if(env.YOOKOO_KV){
    try{
      const stored=await env.YOOKOO_KV.get('road_news_seen_v1',{type:'json'});
      if(Array.isArray(stored)){
        hasComparison=true;
        const seen=new Set(stored);
        for(const x of candidates)x.seen=seen.has(x.link);
        newItems=candidates.filter(x=>!x.seen).slice(0,3);
      }
      if(checked && writeSeen){
        await env.YOOKOO_KV.put('road_news_seen_v1',JSON.stringify([...new Set([...(stored||[]),...candidates.map(x=>x.link)])].slice(-150)));
      }
    } catch(e){errors.push('KV không đọc/ghi được: '+String(e.message||e).slice(0,70));}
  }
  return {checked,errors,candidates,newItems,hasComparison,kv:Boolean(env.YOOKOO_KV),feedSuccess:results.filter(x=>x.status==='fulfilled' && /<rss[\s>]/i.test(x.value)).length,feedTotal:results.length};
}
function roadMessage(r){
  let x='🏗️ ĐƯỜNG VÀNH ĐAI 2 – HOÀNG VĂN THỤ\n';
  x+=`📍 Cà Mau · phường Tân Thành\nNguồn RSS: ${r.feedSuccess}/${r.feedTotal}${r.feedSuccess<r.feedTotal?' — nguồn chưa đầy đủ':''}\nMốc nền đã ghi nhận, chưa xác minh tiến độ hiện tại.\n`;
  x+=`📍 ${ROAD_BASE.length} | Lộ giới: ${ROAD_BASE.width}\n`;
  x+=`💰 Vốn: ${ROAD_BASE.capital}\n`;
  x+=`🏠 GPMB: ${ROAD_BASE.compensation}\n`;
  x+=`👷 Chủ đầu tư: ${ROAD_BASE.owner}\n`;
  x+=`📅 Thực hiện: ${ROAD_BASE.period}\n`;
  x+='\n📌 MỐC ĐÃ ĐỐI CHIẾU (không phải tin mới):\n';
  for(const [date,label] of ROAD_BASE.milestones)x+=`• ${date}: ${label}\n`;
  x+=`🚧 Xây lắp: ${ROAD_BASE.construction}.\n`;
  x+=`🗺️ Mặt bằng: ${ROAD_BASE.land}.\n`;
  x+='\n🆕 TIN PHÁT HIỆN QUA RSS:\n';
  if(!r.checked)x+=`Chưa truy cập được nguồn tin. ${r.errors.slice(0,2).join('; ')}\n`;
  else if(r.hasComparison&&!r.newItems.length){
    x+='Chưa có tiêu đề mới so với lần đọc đã lưu.\n';
    if(r.candidates.length){
      x+='🗂️ Bài RSS đã phát hiện trước đây (CHƯA xác minh nội dung):\n';
      for(const item of r.candidates.slice(0,2))x+=`• ${item.date} · ${item.title.slice(0,120)}\nNguồn: ${item.publisher} (${item.feedName})\n${item.link}\n`;
    }
  }
  else if(!r.candidates.length)x+='Không tìm được tiêu đề phù hợp trong 90 ngày (không đồng nghĩa chưa có tiến triển).\n';
  else{
    if(!r.hasComparison)x+='Lần đầu quét: tin bên dưới CHƯA được đối chiếu với lần trước.\n';
    for(const item of r.newItems.slice(0,2))x+=`• ${item.date}: ${item.title.slice(0,120)}\n${item.link}\n`;
  }
  x+='⚠️ Tin RSS chỉ là đầu mối, KHÔNG xác nhận lựa chọn nhà thầu hay khởi công.\n';
  x+='🔗 Nguồn mốc đầu tư: '+ROAD_BASE.sources[2]+'\n';
  x+='🔗 Nguồn KHLCNT: '+ROAD_BASE.sources[1];
  return x;
}
function newsMessage(r) {
  let x=`📰 YOOKOO /news | ${vnNow()} (VN)\n`+
    'TIN RSS LIÊN QUAN TUYẾN VÀNH ĐAI 2 – HOÀNG VĂN THỤ\n'+
    `Nguồn đọc được: ${r.feedSuccess}/${r.feedTotal}${r.feedSuccess<r.feedTotal?" – nguồn chưa đầy đủ":""} | ${r.candidates.length} tiêu đề phù hợp bộ lọc\n\n`;
  if (!r.checked) return x+'⚠️ Các RSS đều lỗi; không thể kết luận có hay không có tin mới.';
  if (!r.candidates.length) return x+'Không có tiêu đề khớp trong 90 ngày. Điều này không chứng minh dự án không có tiến triển.';
  for (const [i,item] of r.candidates.slice(0,5).entries()) {
    const status=!r.hasComparison?'Chưa có dữ liệu so sánh':item.seen?'Đã ghi nhận trước đây':'Chưa có trong danh sách link đã thấy';
    x+=`${i+1}. ${item.title.slice(0,170)}\n`+
      `📅 ${dmy(item.date)} · ${item.publisher} (qua ${item.feedName})\n`+
      `🗂️ ${status}\n🔗 ${item.link}\n\n`;
  }
  x+='⚠️ Bộ lọc chỉ đánh giá TIÊU ĐỀ. Phải mở bài gốc để kiểm chứng đúng dự án; không tự xem đây là xác nhận đấu thầu/khởi công.';
  return x.slice(0,3900);
}
function healthMessage(v,r,env,c) {
  return (`🩺 YOOKOO /health · CP02-D-R8-TEXT\nF4: GitHub raw/API; đã tắt truy vấn State.\nUSCIS: đã tắt kiểm tra online; chỉ hiển thị hồ sơ đã ghi nhận.\n${f4Message(v,true)}\n${caseMessage(c,true)}\nRSS: ${r.feedSuccess}/${r.feedTotal}${r.feedSuccess<r.feedTotal?' – nguồn chưa đầy đủ':''}\nRSS lỗi: ${r.errors.join('; ')||'không'}\nKV: ${env.YOOKOO_KV?'đã binding':'chưa binding'}`).slice(0,3900);
}
function compactMessage(v,r,c) {
  return `☀️ YOOKOO | ${vnNow()} (VN)\n\n${visaSummary(v)}\n${caseMessage(c)}\n🏗️ Đường Vành đai: xem bản tin riêng ngay sau tin này.\n/case: hồ sơ | /f4: lịch visa | /road: đường Vành đai`;
}
function detailMessage(v,r,c) {return f4Message(v,true)+'\n'+caseMessage(c,true);}
async function telegram(env,chatId,message) {
  const token=env.TELEGRAM_BOT_TOKEN;
  if(!token)throw new Error('Missing TELEGRAM_BOT_TOKEN');
  const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:message,disable_web_page_preview:true})});
  if(!r.ok) throw new Error(`Telegram HTTP ${r.status}`);
  const data=await r.json();if(!data.ok)throw new Error('Telegram refused message');
}
async function telegramLong(env,chatId,message) {
  while(message.length){
    let end=Math.min(3900,message.length);
    if(end<message.length){const line=message.lastIndexOf('\n',end-1);if(line>0)end=line+1;}
    await telegram(env,chatId,message.slice(0,end));message=message.slice(end);
  }
}
async function webhookSecret(token) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function makeAndSend(env,chatId,detailed=false) {
  const [v,r,c]=await Promise.all([visaStatus(env,true),roadStatus(env),caseStatus(env,true)]);
  await sendVisaReport(env,chatId,v,detailed ? detailMessage(v,r,c) : compactMessage(v,r,c));
  // Separate delivery prevents the road report being truncated behind visa/case text.
  await telegramLong(env,chatId,roadMessage(r));
}
export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(path==='/' && request.method==='GET')return new Response('YOOKOO Bot CP02-D-R8-TEXT online.');
    if(path!=='/telegram'||request.method!=='POST') return new Response('Not found',{status:404});
    if(!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID)return new Response('Missing configuration',{status:500});
    const sec=await webhookSecret(env.TELEGRAM_BOT_TOKEN);
    if(request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==sec)return new Response('Forbidden',{status:403});
    let update;
    try{update=await request.json();}catch{return new Response('Invalid JSON',{status:400});}
    const msg=update?.message;
    if(!msg||String(msg.chat?.id)!==String(env.TELEGRAM_CHAT_ID))return new Response('OK');
    const command=String(msg.text||'').trim().split(/\s+/)[0].toLowerCase().split('@')[0];
    if(command==='/start')await telegram(env,msg.chat.id,'✅ YOOKOO Daily Bot CP02-D-R8-TEXT\n/case — hồ sơ đã ghi nhận và link tra cứu\n/road — đường Vành đai\n/f4 — lịch visa F4\n/check — đọc nhanh\n/detail — chi tiết\n/news — xem tất cả tin RSS tìm được\n/health — chẩn đoán nguồn\n/test — kiểm tra Telegram');
    else if(command==='/test')await telegram(env,msg.chat.id,'✅ Telegram hoạt động. Dùng /check để lấy bản tin với nguồn và mức độ xác minh.');
    else if(command==='/help')await telegram(env,msg.chat.id,'Lệnh: /start, /test, /case, /f4, /road, /check, /detail, /news, /health, /help. Bản tin mỗi ngày 08:30 (VN).');
    else if(command==='/f4'){const v=await visaStatus(env,true);await sendVisaReport(env,msg.chat.id,v,f4Message(v,true));}
    else if(command==='/case'){const c=await caseStatus(env,true);await telegram(env,msg.chat.id,caseMessage(c,true));}
    else if(command==='/check')await makeAndSend(env,msg.chat.id);
    else if(command==='/detail')await makeAndSend(env,msg.chat.id,true);
    else if(command==='/road'){const r=await roadStatus(env,false);await telegramLong(env,msg.chat.id,roadMessage(r));}
    else if(command==='/news'){const r=await roadStatus(env,false);await telegram(env,msg.chat.id,newsMessage(r));}
    else if(command==='/health'){const [v,r,c]=await Promise.all([visaStatus(env,false),roadStatus(env,false),caseStatus(env,false)]);await telegram(env,msg.chat.id,healthMessage(v,r,env,c));}
    return new Response('OK');
  },
  async scheduled(controller,env,ctx) {
    if (!env.TELEGRAM_CHAT_ID)throw new Error('Missing TELEGRAM_CHAT_ID');
    await makeAndSend(env,env.TELEGRAM_CHAT_ID);
    console.log('YOOKOO daily message delivered');
  }
};

