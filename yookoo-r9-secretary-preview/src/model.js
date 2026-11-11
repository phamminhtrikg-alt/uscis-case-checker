export const TZ='Asia/Ho_Chi_Minh';
export const LABEL={NOT_STARTED:'Chưa bắt đầu',IN_PROGRESS:'Đang làm',INTERNAL_DONE:'Xong nội bộ',DONE_CONFIRMED:'Hoàn thành xác nhận',AWAITING_FEEDBACK:'Chờ TVGS phản hồi',APPROVED:'TVGS chấp thuận',DELEGATE_WAITING:'Đã giao BR – chờ phản hồi',DELIVERED:'BR đã giao hồ sơ',PAUSED:'Tạm hoãn'};
export const BINDINGS={english:'ropj98chf8jv0jh77fqbpthoto',driving_tue:'obknu4u3luor3hnucl0l0t7ehs',driving_thu:'14ea9p7gogjnvs9eaa8idu3dqk',driving_sat:'e13plccskph5e3uqc2o25jqgk8',driving_sun:'5ojvn16134tfjtk26ub4qi0ois',br_all:'i96utdga6k8m4c9qlobqhievc0',br_nsh:'b7fkgvta6qq7vurgana748n2fo',trip_alarm:'vo65284bfqt7ver1rkak1m6ocs',trip_check:'eovg7ua1o6rka7q60cdgmejvpg'};
export function seed(){
 const titles=['KCS quan trắc lún','KCS tứ nón, chân khay cầu','KCS cầu, kiểm tra & thống kê tần suất đầu vào','Nhật ký các cầu','VO ATGT và cống','Chuẩn hóa VO khối lượng cầu','KCS trạm cân','Thống kê BVTC (6 bộ bản vẽ)','KCS cống tròn'];
 const tasks=Object.fromEntries(titles.map((title,i)=>{const id='W'+String(i+1).padStart(2,'0');return [id,{id,title,owner:i===7?'BR':'user',user_role:i===7?'MONITOR':'DOER',work_state:i>=2&&i<=6?'NOT_STARTED':'IN_PROGRESS',review_state:null,delegation_state:i===7?'DELEGATE_WAITING':null,revision:0}];}));
 tasks['W01.MC4100_4800']={id:'W01.MC4100_4800',parent_id:'W01',title:'KCS lún MC 4100–4800',owner:'user',work_state:'INTERNAL_DONE',review_state:'AWAITING_FEEDBACK',reviewer:'TVGS',sent_at:'2026-11-09',confirmed_at:'2026-11-09',revision:0};
 for(const [id,title] of [['W09.KM3_665','Km3+665'],['W09.KM4_385','Km4+385']])tasks[id]={id,parent_id:'W09',title:'KCS cống tròn '+title,owner:'user',work_state:'IN_PROGRESS',review_state:null,revision:0};
 const br=['BV Trạm cân','BV ATGT cập nhật','BV Trạm biến áp','BV hoàn trả đường gom','BV công phát sinh và mương thoát nước dọc cuối tuyến','BV nút giao NSH'];
 br.forEach((title,i)=>{const id='BR0'+(i+1);tasks[id]={id,parent_id:'W08',title,owner:'BR',user_role:'MONITOR',work_state:'UNKNOWN',delegation_state:'DELEGATE_WAITING',revision:0,note:i===5?'BR kiểm chứng phạm vi; BTN phát sinh tăng khối lượng; giảm cừ tràm vì không di dời đường cống. Chưa có số liệu/hạn chót.':''};});
 return {schema:1,revision:0,tasks,appointments:[],exceptions:[{date:'2026-11-10',kind:'trip',confirmed:true,return_before:'16:00',return_confirmed:false,scope:'work',note:'KCS tạm hoãn; tập lái chỉ khi thực tế về trước 16:00 và đủ khỏe/tỉnh táo.'}],attendance:{'2026-11-09':'NOT_ATTENDED'},bindings:Object.fromEntries(Object.entries(BINDINGS).map(([k,event_id])=>[k,{event_id,timezone:TZ,sync_status:'UNVERIFIED'}])),history:[]};
}
export function local(now=new Date()) {const d=new Date(now.getTime()+7*3600000);return {date:d.toISOString().slice(0,10),time:d.toISOString().slice(11,16),day:d.getUTCDay()};}
export function dayAdd(date,n){return new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function validDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;}
export function norm(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();}
export function taskLine(t){return `${t.id} · ${t.title}: ${LABEL[t.work_state]||'Chưa cập nhật'}${t.review_state?' | '+LABEL[t.review_state]:''}${t.delegation_state?' | '+LABEL[t.delegation_state]:''}${t.owner==='BR'?' (bạn chỉ kiểm tra/đôn đốc)':''}`;}
export function apply(state,event){
 if(event.kind==='task_create'){if(state.tasks[event.task.id])throw Error('TASK_EXISTS');state.tasks[event.task.id]={...event.task,revision:0};}
 else if(event.kind==='task'){const t=state.tasks[event.target];if(!t)throw Error('UNKNOWN_TASK');if(t.revision!==event.expected)throw Error('STALE_TASK');Object.assign(t,event.patch,{revision:t.revision+1,updated_at:event.at});}
 else if(event.kind==='appointment')state.appointments.push(event.appointment);
 else if(event.kind==='exception')state.exceptions.push(event.value);
 else if(event.kind==='attendance')state.attendance[event.date]=event.status;
 else if(event.kind==='binding')Object.assign(state.bindings,event.bindings);
 else if(event.kind==='undo'){const t=state.tasks[event.target];if(!t||t.revision!==event.expected)throw Error('STALE_UNDO');state.tasks[event.target]={...event.before,revision:t.revision+1};}
 else if(event.kind!=='conversation')throw Error('BAD_EVENT');
 state.revision++;state.history.push(event);return state;
}
export function interpret(text,state,now=new Date()){
 const n=norm(text),today=local(now).date;
 if(!/khong|chua/.test(n)&&/(?:mai|hom nay).*?(cong tac|di cong tac|nghi|om)/.test(n))return {kind:'exception',value:{date:/mai/.test(n)?dayAdd(today,1):today,kind:/cong tac/.test(n)?'trip':'unavailable',confirmed:true,scope:'work',return_before:/truoc 16/.test(n)?'16:00':null,return_confirmed:false,note:'Tạm hoãn kế hoạch hành chính trong ngày; giữ nguyên công việc gốc. Chưa xác nhận giờ về hoặc khả năng tham gia lịch cá nhân.'}};
 if(/hom qua.*chua hoc/.test(n))return {kind:'attendance',date:dayAdd(today,-1),status:'NOT_ATTENDED'};
 if(/(?:hom nay|toi).*da hoc.*tieng anh/.test(n))return {kind:'attendance',date:today,status:'ATTENDED_CONFIRMED'};
 // Ambiguous, negative, future and multi-target updates must not be inferred.
 if(/chua|khong|du kien|se |neu |co the/.test(n))return null;
 const targets=[];
 for(const id of Object.keys(state.tasks))if(new RegExp('(?:^|\\s)'+id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|\\s)','i').test(text))targets.push(id);
 if(/4100\s*[–—-]\s*4800/.test(n))targets.push('W01.MC4100_4800');
 if(/(?:km\s*)?3\s*[+,]\s*665/.test(n))targets.push('W09.KM3_665');
 if(/(?:km\s*)?4\s*[+,]\s*385/.test(n))targets.push('W09.KM4_385');
 if(/\bbr\b/.test(n)&&/tram can/.test(n))targets.push('BR01');
 const ids=[...new Set(targets)];if(ids.length!==1)return null;
 const id=ids[0],t=state.tasks[id];
 if(Object.values(state.tasks).some(x=>x.parent_id===id))return {question:`${id} có nhiều phạm vi. Hãy nêu tiểu mục cụ thể; tôi chưa đóng cả nhóm.`};
 let patch=null;
 if(/tvgs.*(?:chap thuan|duyet)/.test(n))patch={review_state:'APPROVED'};
 else if(/gui.*tvgs/.test(n))patch={work_state:'INTERNAL_DONE',review_state:'AWAITING_FEEDBACK',reviewer:'TVGS',sent_at:today};
 else if(t.owner==='BR'&&/da giao|da gui|da nhan/.test(n))patch={delegation_state:'DELIVERED'};
 else if(/(?:da )?xong|hoan thanh|^\/done\b/.test(n))patch={work_state:'DONE_CONFIRMED'};
 else if(/bat dau|dang lam/.test(n))patch={work_state:'IN_PROGRESS'};
 if(!patch)return null;
 return {kind:'task',target:id,patch,expected:t.revision,before:structuredClone(t)};
}
export function personal(date,state){
 const day=new Date(date+'T00:00:00Z').getUTCDay(),items=[];
 if([1,3,5].includes(day))items.push('17:40 đưa con; 19:20 đón con');
 const driving={2:'17:00–18:30',4:'17:00–18:30',6:'16:45–18:15 (đi 16:30, đến 16:40, chuẩn bị 5 phút)',0:'08:00–10:00'};
 if(driving[day])items.push('Tập lái DỰ KIẾN '+driving[day]+'; cần giáo viên xác nhận, đủ khỏe/tỉnh táo');
 if(date==='2026-11-10')items.push('Tập lái chỉ nếu THỰC TẾ về trước 16:00 và đủ khỏe; chưa có xác nhận đã về.');
 items.push('20:00–21:00 tiếng Anh gia đình; 21:45 tổng kết');
 if(date==='2026-11-11')items.push('13:30–13:45 hỏi BR 6 nhóm BVTC (lịch tham chiếu đã có)');
 if(date==='2026-11-13')items.push('13:30–13:45 hỏi BR nút giao NSH (lịch tham chiếu đã có)');
 for(const e of state.exceptions.filter(x=>x.date===date))items.push('Ngoại lệ: '+e.note);
 return items;
}
export function report(state,slot='08:30',now=new Date()){
 const l=local(now),paused=state.exceptions.some(e=>e.date===l.date&&e.scope==='work');
 const candidates=Object.values(state.tasks).filter(t=>t.owner==='user'&&t.category!=='personal'&&['IN_PROGRESS','NOT_STARTED'].includes(t.work_state)&&!Object.values(state.tasks).some(c=>c.parent_id===t.id)).sort((a,b)=>(a.work_state==='IN_PROGRESS'?0:1)-(b.work_state==='IN_PROGRESS'?0:1)).slice(0,3);
 const question={'08:30':'Bạn muốn bổ sung hoặc đổi ưu tiên sáng nay?','11:45':'Sáng nay xong phạm vi nào, còn thiếu hoặc vướng gì?','13:30':'Chiều nay ưu tiên nào? Kiểm tra lịch hẹn trước khi bắt đầu.','16:30':'Km3+665 và Km4+385: mỗi cống đã đến đâu? TVGS/BR có phản hồi chưa?','21:45':'Hôm nay đã học tiếng Anh chưa? Ngày mai có công tác, nghỉ hoặc việc mới không?'}[slot];
 return `🗓️ THƯ KÝ ${slot} · ${l.date}\n${l.day===0?'Chủ nhật: không giao ca hành chính.':paused?'Kế hoạch hành chính tạm hoãn theo ngoại lệ; công việc gốc vẫn giữ.':'Ưu tiên ĐỀ XUẤT (không phải hạn chót):\n'+candidates.map(taskLine).join('\n')}\nChờ TVGS: ${Object.values(state.tasks).filter(t=>t.review_state==='AWAITING_FEEDBACK').map(t=>t.id).join(', ')||'không có mục đang chờ'}\nBR: chỉ kiểm tra/đôn đốc, không tự bóc tách thay BR.\n${personal(l.date,state).join('\n')}\n${question||''}`;
}
export function due(now){const l=local(now);return ['08:30','11:45','13:30','16:30','21:45'].includes(l.time)&&(l.time==='21:45'||l.day!==0)?`${l.date}:${l.time}`:null;}
export function english(){return '👨‍👩‍👧‍👦 20:00–21:00: Yookoo, Ivy, Jacky, Sunny\n10 phút phát âm; 20 phút trường học lớp 1–2; 20 phút tiệm nail; 10 phút đóng vai cả nhà.\nMở ChatGPT Voice và nói “Bắt đầu buổi học tiếng Anh gia đình”. Mỗi người tự xưng tên trước lượt nói. Bot không tự mở Voice hoặc tự đánh dấu đã học.';}

export function localReminders(state,now,personalEnabled=false){
 const l=local(now),items=[];
 for(const a of state.appointments||[])if(local(new Date(Date.parse(`${a.date}T${a.start}:00+07:00`)-15*60000)).date===l.date&&local(new Date(Date.parse(`${a.date}T${a.start}:00+07:00`)-15*60000)).time===l.time)items.push({id:'appointment:'+a.id,text:`🔔 ${a.start}–${a.end}: ${a.title}. Lịch lưu trong bot, chưa đồng bộ Google Calendar.`});
 if(personalEnabled){
  if([1,3,5].includes(l.day)&&['17:25','19:05'].includes(l.time))items.push({id:'children:'+l.time,text:l.time==='17:25'?'17:40 đưa con đi học.':'19:20 đón con.'});
  if(l.time==='19:45')items.push({id:'english',text:'20:00–21:00 tiếng Anh gia đình. Mở ChatGPT và nói “Bắt đầu buổi học tiếng Anh gia đình”. Chưa tự đánh dấu đã học.'});
  const times={2:'16:45',4:'16:45',6:'16:30',0:'07:45'};
  if(times[l.day]===l.time)items.push({id:'driving',text:'Tập lái DỰ KIẾN: cần giáo viên xác nhận và đủ khỏe/tỉnh táo. '+(l.day===6?'Đi 16:30, đến 16:40, chuẩn bị để học 16:45.':'Di chuyển từ nơi thường ngày khoảng 10 phút.')+(state.exceptions.some(e=>e.date===l.date)?' Hôm nay có ngoại lệ; xác nhận đã về và đủ sức khỏe trước khi tham gia.':'')});
 }
 return items;
}
