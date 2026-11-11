import {local,dayAdd,validDate,interpret,report,taskLine,personal,english,BINDINGS,TZ} from './model.js';
import {converse} from './assistant.js';
import {conflicts} from './calendar.js';
export async function calendarContext(calendar,date){
 if(!calendar.configured())return '\nCalendar chưa kết nối: lịch trên là tham chiếu, chưa đối chiếu thay đổi mới.';
 try{const events=await calendar.list(date);const overlaps=[];for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++)if(conflicts([events[j]],events[i].start?.dateTime||events[i].start?.date,events[i].end?.dateTime||events[i].end?.date).length)overlaps.push((events[i].summary||'Lịch')+' / '+(events[j].summary||'Lịch'));return '\nCalendar thực tế:\n'+(events.slice(0,8).map(e=>(e.start?.dateTime||e.start?.date)+' · '+e.summary).join('\n')||'Không có sự kiện.')+(overlaps.length?'\nTrùng giờ cần xem lại: '+overlaps.join('; '):'');}catch{return '\nChưa đọc được Calendar; không kết luận lịch trống.';}
}
export const HELP='/add work|personal <tên việc> · thêm việc\n/daily · hôm nay\n/tasks [trạng thái] · 9 nhóm\n/task W09 · từng cống\n/waiting · chờ TVGS/BR\n/done <mã> · đề xuất hoàn thành\n/history · lịch sử\n/undo <mã cập nhật> · hoàn tác công việc\n/calendar [today|tomorrow|YYYY-MM-DD] · lịch\n/calendar sync · đối chiếu ID cũ, không tạo lịch\n/move <tên lịch> YYYY-MM-DD HH:mm HH:mm · dời một buổi\n/event YYYY-MM-DD HH:mm HH:mm <tên> · thêm lịch sau xác nhận\n/snooze YYYY-MM-DD <lý do> · ngoại lệ cả ngày làm việc\n/plan tomorrow · đề xuất ngày mai\n/english · lớp gia đình\n/confirm <mã> · xác nhận\n/cancel <mã> · hủy đề xuất\n/check /f4 /case /road /news /health giữ nguyên.\nBạn cũng có thể nhắn bằng tiếng Việt tự nhiên.';
function summary(p){if(p.kind==='appointment')return `Lưu lịch CHỈ TRONG BOT: ${p.appointment.date} ${p.appointment.start}–${p.appointment.end} ${p.appointment.title}; nhắc trước 15 phút. Chưa đồng bộ Google Calendar.`;if(p.kind==='task_create')return `Thêm ${p.task.id}: ${p.task.title} (${p.task.category==='personal'?'cá nhân':'công việc'}), chưa bắt đầu.`;if(p.kind==='task')return `${p.target}: ${JSON.stringify(p.patch)}\nChỉ cập nhật tiểu mục này, không đóng các nhóm hoặc tiểu mục khác.`;if(p.kind==='undo')return `Hoàn tác ${p.target} về trạng thái trước ${p.undo_id}.`;if(p.kind==='exception')return `${p.value.date}: ${p.value.note}`;if(p.kind==='attendance')return `${p.date}: ${p.status==='NOT_ATTENDED'?'Chưa học tiếng Anh':'Đã học tiếng Anh theo xác nhận'}`;if(p.kind==='calendar_move')return `Dời MỘT buổi ${p.summary} ngày ${p.date} sang ${p.start}–${p.end}. Không sửa chuỗi lặp.`;return `Thêm lịch ${p.date} ${p.start}–${p.end}: ${p.title}`;}
export async function processText(text,id,store,meta,calendar,env,now=new Date()){
 const state=await store.load(),parts=text.trim().split(/\s+/),command=parts[0].toLowerCase().split('@')[0],today=local(now).date;
 async function propose(p){const token='p'+String(id).replace(/[^a-zA-Z0-9_-]/g,'');await meta.put('proposal:'+token,{...p,id:token,createdAt:now.toISOString(),expiresAt:now.getTime()+3600000,proposal_status:'PENDING'});return `📝 ĐỀ XUẤT — chưa lưu thay đổi\n${summary(p)}\n${p.conflicts?'⚠️ Trùng lịch: '+p.conflicts+'\n':''}/confirm ${token}\n/cancel ${token}`;}
 if(command==='/confirm'||command==='/cancel'){
  const p=await meta.get('proposal:'+parts[1]);if(!p||p.proposal_status!=='PENDING')return 'Đề xuất không còn chờ xác nhận.';
  if(now.getTime()>p.expiresAt)return 'Đề xuất đã hết hạn; hãy gửi lại để xem trạng thái mới.';
  if(command==='/cancel'){await meta.put('proposal:'+p.id,{...p,proposal_status:'CANCELLED'});return 'Đã hủy đề xuất. Dữ liệu gốc giữ nguyên.';}
  const eventId='confirm-'+p.id;
  if(!state.history.some(e=>e.id===eventId)){
   if(p.kind.startsWith('calendar_')){
    if(Date.parse(p.date+'T'+p.start+':00+07:00')<=now.getTime())return 'Không ghi lịch trong quá khứ. Hãy chọn lại thời gian.';
    const e=p.kind==='calendar_move'?await calendar.move(p,eventId):await calendar.create(p,eventId);
    await store.append({kind:'binding',id:eventId,at:now.toISOString(),bindings:{['user_'+p.id]:{event_id:e.id,calendar_id:calendar.calendarId,timezone:TZ,recurrence:e.recurrence||[],sync_status:'VERIFIED',operation:eventId}}});
   } else await store.append({...p,id:eventId,at:now.toISOString(),source:'telegram-confirmed'});
  }
  await meta.put('proposal:'+p.id,{...p,proposal_status:'CONFIRMED'});
  return `✅ Đã ghi nhận ${eventId}.\n${summary(p)}${p.kind==='task'?'\n/undo '+eventId:''}`;
 }
 if(command==='/start'||command==='/help')return 'YOOKOO · Thư ký cá nhân\n'+HELP;
 if(command==='/add'||/^(thêm việc|them viec) /i.test(text)){const natural=!command.startsWith('/');const category=natural?'work':parts[1];const title=natural?text.replace(/^(thêm việc|them viec) /i,'').trim():parts.slice(2).join(' ');if(!['work','personal'].includes(category)||title.length<3||title.length>200)return 'Dùng /add work tên việc hoặc /add personal tên việc cá nhân.';return propose({kind:'task_create',task:{id:'U'+String(id),title,category,owner:'user',user_role:'DOER',work_state:'NOT_STARTED',review_state:null}});}
 if(command==='/daily')return report(state,'08:30',now)+await calendarContext(calendar,today);
 if(command==='/tasks')return Object.values(state.tasks).filter(t=>!t.parent_id&&(!parts[1]||t.work_state===parts[1].toUpperCase())).map(taskLine).join('\n');
 if(command==='/task'){const target=parts[1]?.toUpperCase();return Object.values(state.tasks).filter(t=>t.id===target||t.parent_id===target).map(t=>taskLine(t)+(t.note?'\n'+t.note:'')).join('\n')||'Không tìm thấy mã. Dùng /tasks.';}
 if(command==='/waiting')return Object.values(state.tasks).filter(t=>t.review_state==='AWAITING_FEEDBACK'||t.delegation_state==='DELEGATE_WAITING').map(taskLine).join('\n')||'Không có mục đang chờ.';
 if(command==='/history')return state.history.filter(e=>e.kind!=='conversation').slice(-10).map(e=>`${e.id} · ${e.at} · ${e.kind} ${e.target||e.date||''}`).join('\n')||'Chưa có cập nhật sau bản bàn giao.';
 if(command==='/undo'){
  const event=state.history.find(e=>e.id===parts[1]);if(!event||event.kind!=='task')return 'Chỉ hoàn tác cập nhật công việc có mã trong /history. Lịch Calendar cần đề xuất dời mới.';
  const t=state.tasks[event.target];if(t.revision!==event.expected+1)return 'Có cập nhật mới hơn cho mục này. Không hoàn tác đè lên dữ liệu mới.';
  return propose({kind:'undo',target:t.id,expected:t.revision,before:event.before,undo_id:event.id});
 }
 if(command==='/plan'){const date=parts[1]==='tomorrow'?dayAdd(today,1):today;return 'KẾ HOẠCH ĐỀ XUẤT — chưa ghi Calendar\n'+report(state,'08:30',new Date(date+'T08:30:00+07:00'))+await calendarContext(calendar,date);}
 if(command==='/english')return english();
 if(command==='/snooze'){
  if(!validDate(parts[1])||parts[1]<today||parts.length<3)return 'Dùng /snooze YYYY-MM-DD lý do. Chỉ tạm hoãn kế hoạch hành chính ngày đó, không sửa trạng thái công việc hay chuỗi Calendar.';
  return propose({kind:'exception',value:{date:parts[1],kind:'unavailable',scope:'work',confirmed:true,note:parts.slice(2).join(' ').slice(0,150)}});
 }
 if(command==='/calendar'){
  if(!calendar.configured())return 'Google Calendar chưa kết nối trong bot. Lịch tham chiếu (chưa đối chiếu):\n'+personal(parts[1]==='tomorrow'?dayAdd(today,1):today,state).join('\n')+'\nLịch riêng trong bot:\n'+(state.appointments||[]).map(a=>`${a.date} ${a.start} ${a.title}`).join('\n')+'\nKhông tạo lại các sự kiện hiện hữu.';
  if(parts[1]==='sync'){const bindings=await calendar.audit();await store.append({kind:'binding',id:'audit-'+id,at:now.toISOString(),bindings});return 'Đối chiếu chỉ đọc, không tạo/sửa lịch:\n'+Object.entries(bindings).map(([k,v])=>`${k}: ${v.sync_status}`).join('\n');}
  const date=parts[1]==='tomorrow'?dayAdd(today,1):validDate(parts[1])?parts[1]:today;
  const items=await calendar.list(date);return `Google Calendar ${date}\n`+(items.map(e=>`${e.start?.dateTime||e.start?.date} · ${e.summary||'(không tên)'}`).join('\n')||'Không có sự kiện.');
 }
 if(command==='/move'){
  if(!calendar.configured())return 'Chưa kết nối Calendar; chưa sửa lịch.';
  if(parts.length!==5||!BINDINGS[parts[1]])return 'Dùng /move <'+Object.keys(BINDINGS).join('|')+'> YYYY-MM-DD HH:mm HH:mm';
  if(!validDate(parts[2])||Date.parse(parts[2]+'T'+parts[3]+':00+07:00')<=now.getTime())return 'Cần ngày giờ hợp lệ trong tương lai.';
  const plan=await calendar.prepareMove(...parts.slice(1));const other=conflicts(await calendar.list(plan.date),`${plan.date}T${plan.start}:00+07:00`,`${plan.date}T${plan.end}:00+07:00`).filter(e=>e.id!==plan.event_id);
  return propose({...plan,conflicts:other.map(e=>e.summary||e.id).join(', ')});
 }
 if(command==='/event'){
  
  const [date,start,end]=parts.slice(1),title=parts.slice(4).join(' ').slice(0,200);
  if(!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end||'')||start>=end||!title||Date.parse(`${date}T${start}:00+07:00`)<=now.getTime())return 'Dùng /event YYYY-MM-DD HH:mm HH:mm tên lịch (thời gian trong tương lai).';
  if(!calendar.configured()){if((state.appointments||[]).some(a=>a.date===date&&a.start===start&&a.title===title))return 'Đã có lịch này trong bot.';return propose({kind:'appointment',appointment:{id:'a'+id,date,start,end,title,timezone:TZ,provider:'bot-only'}});}
  const items=await calendar.list(date);
  if(items.some(e=>e.summary===title&&Date.parse(e.start?.dateTime)===Date.parse(`${date}T${start}:00+07:00`)))return 'Đã có sự kiện cùng tên và giờ bắt đầu; không tạo bản trùng.';
  return propose({kind:'calendar_create',date,start,end,title,conflicts:conflicts(items,`${date}T${start}:00+07:00`,`${date}T${end}:00+07:00`).map(e=>e.summary||e.id).join(', ')});
 }
 const intent=interpret(text,state,now);if(intent?.question)return intent.question;if(intent)return propose(intent);
 if(command.startsWith('/'))return 'Chưa rõ lệnh/phạm vi.\n'+HELP;
 const ai=await converse(text,state,env);
 if(ai.action)return propose(ai.action);
 if(env.OPENAI_API_KEY&&env.OPENAI_MODEL)await store.append({kind:'conversation',id:'chat-'+id,at:now.toISOString(),user:text.slice(0,4000),reply:ai.reply});
 return ai.reply;
}
