# YOOKOO Bot Daily — Bàn giao module Thư ký cá nhân

> **Loại tài liệu:** Product + implementation handoff cho Codex  
> **Phiên bản đặc tả:** 1.0  
> **Mốc dữ liệu:** 11/11/2026, 12:10, `Asia/Ho_Chi_Minh`  
> **Ngôn ngữ:** Tiếng Việt  
> **Mục tiêu:** Tích hợp hành vi thư ký hiện có vào YOOKOO Bot Daily; không tự giả định đã tích hợp hoặc đã đồng bộ vào bot.

## 1. Nhiệm vụ cho Codex

Triển khai module **Personal Secretary / Daily Planner** bên trong dự án YOOKOO Bot Daily đang có. Trước khi thay đổi, **đọc repo, kiến trúc, các bot command, scheduler, DB, Google Calendar integration và notification provider hiện hữu**. Tái sử dụng hạ tầng có sẵn, không xây hệ thống song song hay làm hỏng chức năng cũ.

**Yêu cầu vận hành:**

1. Lưu công việc, công việc con, tiến độ, bên chịu trách nhiệm, sự kiện, nhắc nhở, lịch sử thay đổi ở DB bền vững (không chỉ dựa vào prompt/chat memory).
2. Giao việc/báo cáo 5 mốc: 08:30, 11:45, 13:30, 16:30 các ngày **thứ Hai–thứ Bảy**; 21:45 **hằng ngày**.
3. Nhận câu tiếng Việt tự nhiên như `Đã xong KCS lún MC 4100–4800, gửi TVGS`, `BR đã hoàn thành BV trạm cân`, `Mai tôi đi công tác`, rồi **cập nhật đúng phạm vi được xác nhận**, báo thay đổi và đưa lịch tương ứng.
4. Đọc/ghi Google Calendar có kiểm tra trùng lặp; chỉ thao tác theo quyền đã cấp; log `calendar_event_id`, timezone, recurrence; không tạo trùng khi retry.
5. Xuất tin Telegram/notification ngắn, rõ: **Đang làm / Chưa bắt đầu / Đã giao bên ngoài – chờ phản hồi / Đã gửi TVGS – chờ phản hồi / Hoàn thành xác nhận**.
6. Không tự đánh dấu hoàn thành dựa vào thời gian biểu hoặc vì sự kiện đã kết thúc. Nếu thiếu kết quả, hỏi xác minh.
7. Có cơ chế quản lý ngoại lệ (đi công tác, ốm, nghỉ, lịch tập lái có điều kiện): bảo toàn các công việc gốc, **tạm hoãn hoặc dời đề xuất**, không coi là hoàn thành.
8. Hỗ trợ cập nhật lịch, trạng thái công việc và lịch sử từ Telegram; tránh phải nhập lại đầy đủ 9 đầu việc mỗi lần.
9. Có test unit/integration tối thiểu và kịch bản acceptance ở mục 12.

**Quy tắc:** Dữ liệu mốc bên dưới chỉ là *snapshot*, phải cho phép cập nhật; chỉ tin các trạng thái mới do người dùng xác nhận. Codex không được giả định công việc/sự kiện đã hoàn tất vì đã qua thời gian.

## 2. Múi giờ và lịch cố định

- Timezone: **`Asia/Ho_Chi_Minh`** (UTC+07).
- Làm hành chính **T2–T7**: `08:30–11:45` và `13:30–16:30`. Chủ nhật **không làm hành chính**.
- **T2/T4/T6**: `17:40` đưa con đi học; `19:20` đón con.
- **Tập lái xe thực hành — lịch DỰ KIẾN**, chưa phải lịch giáo viên xác nhận:
  - T3 `17:00–18:30`
  - T5 `17:00–18:30`
  - T7 `16:45–18:15`
  - CN `08:00–10:00`
  - Thời gian di chuyển **từ nơi thường ngày đến sân tập**: khoảng **10 phút**. Riêng T7 tan làm 16:30 → đi 16:30–16:40 → chuẩn bị 16:40–16:45 → học 16:45; **không tự đề nghị lùi sang 17:00 vì quãng đường**.
- Tiếng Anh giao tiếp **gia đình cùng ChatGPT**: **mỗi ngày `20:00–21:00`**, Google Calendar hiện đã có chuỗi lặp từ **09/11/2026**, nhắc popup 15 phút trước.
- Họp/thư ký buổi tối **21:45 hằng ngày** để tổng kết và hỏi kế hoạch ngày mai.
- Giữ các mục cá nhân và công việc riêng biệt. Khi lịch trùng, ưu tiên hỏi người dùng hoặc áp dụng quy tắc ngoại lệ đã được xác nhận, không sửa sự kiện lặp hàng loạt khi chỉ có một ngoại lệ.

### 2.1. Lớp tiếng Anh gia đình

- Thành viên dùng tên trong buổi học: **Yookoo (bố), Ivy (mẹ), Jacky (con trai), Sunny (con gái)**.
- Mục tiêu: Yookoo/Ivy luyện giao tiếp Mỹ trong **tiệm nail**; Jacky/Sunny giao tiếp tiểu học Mỹ, lớp 1–2.
- Giọng dạy: vui vẻ, hài hước, chủ động, luyện hỏi–đáp, đóng vai, trò chơi.
- Gợi ý 60 phút:
  - 20:00–20:10 khởi động/phát âm
  - 20:10–20:30 trẻ em: trường học, giáo viên, bạn bè
  - 20:30–20:50 người lớn: khách hàng tiệm nail, dịch vụ, lịch hẹn
  - 20:50–21:00 cả nhà đóng vai, kiểm tra nhanh
- **Chỉ đánh dấu đã học khi người dùng xác nhận**. Ngày **09/11/2026 CHƯA học** do người dùng đau đầu.
- Bot/Google Calendar **không tự bật ChatGPT Voice hay bắt đầu cuộc thoại**. Nhắc mở app và nói `Bắt đầu buổi học tiếng Anh gia đình`; nếu nhiều người tham gia, nên tự xưng tên trước lượt nói; không hứa nhận diện giọng hoàn hảo.

## 3. Danh mục 9 NHÓM công việc hành chính — snapshot

| ID | Nhóm việc | Trạng thái đã biết | Người/bên xử lý | Ghi chú |
|---|---|---|---|---|
| W01 | KCS quan trắc lún | Đang theo dõi nhiều phạm vi; **MC 4100–4800 đã xử lý xong và gửi TVGS** | Người dùng | **Chờ TVGS phản hồi**, chưa biết được chấp thuận; không coi toàn bộ KCS lún đã xong |
| W02 | KCS tứ nón, chân khay cầu | Đang thực hiện | Người dùng | Chưa báo hoàn thành |
| W03 | KCS cầu, kiểm tra & thống kê tần suất đầu vào | Chưa bắt đầu | Người dùng | Chưa báo khởi động |
| W04 | Nhật ký các cầu | Chưa bắt đầu | Người dùng | Chưa báo khởi động |
| W05 | VO ATGT và cống | Chưa bắt đầu | Người dùng | Chưa báo khởi động |
| W06 | Chuẩn hóa VO khối lượng cầu | Chưa bắt đầu | Người dùng | Chưa báo khởi động |
| W07 | KCS trạm cân | Chưa bắt đầu | Người dùng | Chưa báo khởi động |
| W08 | Thống kê BVTC (6 bộ bản vẽ) | **ĐÃ THÔNG BÁO/GIAO BR – CHỜ BR CẬP NHẬT** | **Nhà thầu thiết kế TKBVTC BR** | Người dùng **chỉ kiểm tra/đôn đốc**; KHÔNG tự thống kê/bóc tách thay BR |
| W09 | KCS cống tròn | Đang thực hiện | Người dùng | Phải theo dõi riêng **Km3+665** và **Km4+385**, cả hai chưa báo hoàn thành |

### 3.1. Chi tiết W01 — KCS quan trắc lún

- Tiểu mục `W01.MC4100_4800`:
  - **Xử lý nội bộ:** `done_confirmed` ngày **09/11/2026**.
  - **Đã gửi:** `sent_to_TVGS` ngày **09/11/2026**.
  - **TVGS chấp thuận:** `pending_feedback` (CHƯA CÓ XÁC NHẬN).
  - **Hành động tiếp:** Theo dõi phản hồi TVGS; chỉ phân lịch chỉnh sửa nếu TVGS thực sự yêu cầu.
- **Tuyệt đối không** hiểu `MC 4100–4800` là mọi mặt cắt trong toàn dự án, hay tự chia phạm vi thành danh sách các mặt cắt đã duyệt. Ví dụ MC 3280/3380 từng được nêu chỉ là ví dụ, không phải kết quả xác nhận.

### 3.2. Chi tiết W09 — KCS cống tròn

| Tiểu mục | Trạng thái | Lưu ý |
|---|---|---|
| `W09.KM3_665` | Đang thực hiện | Chưa có xác nhận xong |
| `W09.KM4_385` | Đang thực hiện | Chưa có xác nhận xong |

Đánh dấu xong một cống **không** tự hoàn thành cống còn lại hoặc toàn bộ W09. Lịch KCS ngày **10/11/2026** đã bị **tạm hoãn do công tác**; chờ bố trí lại theo thông tin cập nhật.

### 3.3. Chi tiết W08 — 6 nhóm bản vẽ do BR thực hiện

| ID | Phạm vi giao BR | Trạng thái |
|---|---|---|
| `BR01` | BV Trạm cân | Đã giao BR, chưa nhận tiến độ chi tiết |
| `BR02` | BV ATGT cập nhật | Đã giao BR, chưa nhận tiến độ chi tiết |
| `BR03` | BV Trạm biến áp | Đã giao BR, chưa nhận tiến độ chi tiết |
| `BR04` | BV hoàn trả đường gom | Đã giao BR, chưa nhận tiến độ chi tiết |
| `BR05` | **BV công phát sinh** và mương thoát nước dọc cuối tuyến | Đã giao BR, chưa nhận tiến độ chi tiết |
| `BR06` | BV nút giao NSH | Đã giao BR, chưa nhận tiến độ chi tiết |

> Giữ nguyên chữ **“công phát sinh”** vì người dùng chưa xác nhận có phải muốn viết “cống phát sinh” hay không; không tự sửa tên gốc.

**Riêng BR06 nút giao NSH:** BR cần cập nhật/kiểm chứng bản vẽ và số liệu về (i) nâng cấp bê tông nhựa phát sinh **tăng khối lượng**, (ii) điều chỉnh phạm vi, (iii) **giảm khối lượng đóng cừ tràm** vì **không di dời đường cống**. Không bịa số liệu, % hay thời hạn. Người dùng chỉ đôn đốc tiến độ và tiếp nhận hồ sơ BR.

**Nhắc BR đã có trên Google Calendar** (mốc đã tạo, có thể đã qua khi bot được triển khai):
- **Tư 11/11/2026, 13:30–13:45:** hỏi BR tiến độ **6 nhóm BVTC**; chỉ 15 phút, không phải thời gian tự thống kê.
- **Sáu 13/11/2026, 13:30–13:45:** hỏi BR riêng **nút giao NSH**; chỉ 15 phút.

Nếu nhập dữ liệu sau ngày hẹn, đừng tạo nhắc trong quá khứ hay nhân bản sự kiện; cân nhắc ghi lịch sử và hỏi người dùng có muốn đặt lại cuộc kiểm tra hay không.

## 4. Ngoại lệ đã biết ngày 09–10/11/2026

### 09/11
- KCS quan trắc lún **MC 4100–4800 hoàn thành phần nội bộ và đã gửi TVGS**, nhưng **chưa có phản hồi/chấp thuận**.
- Buổi tiếng Anh gia đình **chưa học** vì người dùng đau đầu; đã thông báo dùng **1 viên Panadol** (không rõ hàm lượng, không đưa hướng dẫn liều theo dữ liệu này).

### 10/11
- Công tác **TP.HCM**, kế hoạch **06:00 khởi hành**, **05:30** có thông báo Google Calendar (không phải báo thức có chuông liên tục).
- Người dùng **dự kiến trở về trước 16:00**, KHÔNG phải xác nhận đã về. Chưa có báo cáo kết quả công tác, giờ về thực tế, sức khỏe hay đã tập lái/học tiếng Anh tối đó.
- Ca KCS sáng/chiều ngày 10/11 đã **tạm hoãn vì công tác**, không đánh dấu hoàn thành.
- Có nhắc **15:45** xác minh có trở về kịp không.
- Buổi tập lái **17:00–18:30** được **giữ lịch dự kiến có điều kiện**: **chỉ tham gia nếu thực tế về trước 16:00 VÀ đủ khỏe/tỉnh táo**. Nếu còn đau đầu/mệt/buồn ngủ hoặc chưa về, hoãn/báo giáo viên. Khoảng 10 phút từ nơi thường ngày tới sân tập **không phải thời gian từ TP.HCM**.
- Nếu đưa vào bot sau mốc 10/11, giữ như **lịch sử**, không gửi báo thức cũ.

### 11/11 — trạng thái tại thời điểm snapshot
- Sáng 08:30–11:45 từng được **đề xuất** dành cho KCS 2 cống, nhưng **chưa có báo cáo kết quả**.
- 13:30–13:45 có lịch theo dõi BR (xem mục 3.3).
- Chiều dự kiến KCS tứ nón chân khay, khởi động KCS cầu/tần suất hoặc nhật ký. **Đây là KẾ HOẠCH ĐỀ XUẤT, không phải bằng chứng đã làm**.
- T2/T4/T6 (hôm nay Tư) đưa con 17:40, đón 19:20.
- Tiếng Anh gia đình 20:00–21:00; chưa có kết quả học.

## 5. Lịch nhắc của thư ký — quy tắc

| Giờ | Ngày | Nội dung nhắc |
|---|---|---|
| **08:30** | T2–T7 | Giao việc sáng: 1–3 ưu tiên thật, hỏi có bổ sung/đổi ưu tiên; rà soát lịch cá nhân |
| **11:45** | T2–T7 | Chốt sáng: hỏi hồ sơ/mặt cắt đã xong, còn thiếu, vướng mắc; chuyển phần chưa xong sang chiều |
| **13:30** | T2–T7 | Giao việc chiều theo **tiến độ mới nhất**, lưu ý nhắc BR nếu đúng lịch; tránh xung đột |
| **16:30** | T2–T7 | Chốt ngày: hỏi riêng từng cống/mặt cắt, tách chờ TVGS, chờ BR, nhắc lịch tối |
| **21:45** | Mỗi ngày | Tổng kết, hỏi đã học tiếng Anh chưa (không tự kết luận); hỏi bổ sung công việc/ngày mai |

**Lịch phụ**: đưa/đón con T2/T4/T6, tập lái, tiếng Anh gia đình, các nhắc BR/TVGS, các ngoại lệ có ngày/giờ cụ thể. Scheduler phải sử dụng timezone `Asia/Ho_Chi_Minh`, chống thông báo trùng giữa ChatGPT Automations, Google Calendar và bot nếu user không muốn nhiều thông báo.

### Các ChatGPT Automations đã có — tham chiếu để migration (không gọi API trên những ID này nếu không có công cụ tương ứng)

- `6af12d4684c48191b30f1d6bc2ccac1b` — Thư ký 08:30
- `6af13086c3d881918503c25dcfe53a8b` — Thư ký 11:45
- `6af1308a51808191822bf1f746e77161` — Thư ký 13:30
- `6af12d49a76c8191910b97b230616b91` — Thư ký 16:30
- `Automation_a72688d1dddc8191a9efd0da176b6391` — Thư ký 21:45

> ID chỉ dùng để kiểm kê/migration. Không được giả định YOOKOO Bot Daily có quyền chỉnh các ChatGPT Automations này. **Sau khi chuyển bot chạy ổn định**, hỏi người dùng có muốn tắt nguồn nhắc cũ để tránh thông báo kép; không tự tắt.

### Các Google Calendar event ID đã biết (tham chiếu, phải kiểm tra lại khi đồng bộ)

- Tiếng Anh gia đình (chuỗi lặp): `ropj98chf8jv0jh77fqbpthoto`.
- Tập lái T3 (chuỗi lặp): `obknu4u3luor3hnucl0l0t7ehs`.
- Tập lái T5: `14ea9p7gogjnvs9eaa8idu3dqk`.
- Tập lái T7: `e13plccskph5e3uqc2o25jqgk8`.
- Tập lái CN: `5ojvn16134tfjtk26ub4qi0ois`.
- Nhắc BR 11/11: `i96utdga6k8m4c9qlobqhievc0`.
- Nhắc BR NSH 13/11: `b7fkgvta6qq7vurgana748n2fo`.
- Nhắc dậy 05:30 ngày 10/11: `vo65284bfqt7ver1rkak1m6ocs`.
- Nhắc kiểm tra tập lái 15:45 ngày 10/11: `eovg7ua1o6rka7q60cdgmejvpg`.
- Các event ID trên **không phải bí mật**, nhưng vẫn cần dùng kết nối Google Calendar được cấp quyền, và không cố thực thi nếu token/permissions không có.

## 6. Phân biệt trạng thái — business rules bắt buộc

Đề xuất enums:

```text
NOT_STARTED        Chưa bắt đầu
IN_PROGRESS        Đang thực hiện
INTERNAL_DONE      Đã làm xong nội bộ
SENT_FOR_REVIEW    Đã gửi TVGS/đơn vị kiểm tra
AWAITING_FEEDBACK  Chờ phản hồi
APPROVED           Được phê duyệt/xác nhận bởi đơn vị có thẩm quyền
DELEGATED          Đã giao bên khác thực hiện
DELEGATE_WAITING   Đã giao bên khác – chờ tiến độ
PAUSED             Tạm hoãn, chưa hoàn thành
DONE_CONFIRMED     Đã hoàn thành được người dùng xác nhận
UNKNOWN            Chưa cập nhật
```

Hệ thống phải hỗ trợ **nhiều chiều trạng thái** (ví dụ `work_state=INTERNAL_DONE`, `review_state=AWAITING_FEEDBACK`, `reviewer=TVGS`) thay vì ép vào một enum duy nhất. Với BR, `owner=BR`, `delegation_state=DELEGATE_WAITING`, `user_role=MONITOR`.

Một tin nhắn cập nhật có thể chứa **sự kiện đã xảy ra** (đã gửi TVGS), **dự kiến** (về trước 16:00) và **điều kiện** (chỉ tập khi về kịp) — cần lưu tách biệt `confirmed`, `planned`, `conditional`.

## 7. Schema dữ liệu tham khảo

```yaml
user_timezone: Asia/Ho_Chi_Minh
workweek: [MO, TU, WE, TH, FR, SA]
work_windows:
  - ["08:30", "11:45"]
  - ["13:30", "16:30"]
task:
  id: W09.KM3_665
  parent_id: W09
  title: KCS cống tròn Km3+665
  owner_type: user  # user | external
  owner_name: null
  work_state: IN_PROGRESS
  review_state: null
  updated_at: null
  confirmed_by_user: true
  note: null
  source: chat
  next_action: "Hỏi phần đã xong, phần còn thiếu"
external_followup:
  id: BR06
  organization: BR
  title: BV nút giao NSH
  delegation_state: DELEGATE_WAITING
  expected_delivery_at: null
  last_response_at: null
  next_check_at: null
  notes: "BTN tăng; cừ tràm giảm vì không di dời đường cống"
appointment:
  id: driving-tuesday
  start: "17:00"
  end: "18:30"
  recurrence: "FREQ=WEEKLY;BYDAY=TU"
  tentative: true
  conditions:
    - "Ngày 10/11 về trước 16:00"
    - "Đủ sức khỏe/tỉnh táo"
calendar_sync:
  provider: google
  calendar_id: primary
  event_id: null
  sync_status: unknown
  idempotency_key: null
```

**Data model bổ sung:** `task_events` (event-sourced log), `reminder_jobs`, `reminder_deliveries`, `calendar_bindings`, `user_confirmation`, `health_related_schedule_constraints` (chỉ lưu tối thiểu, không lưu chi tiết sức khỏe không cần thiết). Có chỉ mục trên `time_zone`, `due_at`, `next_check_at`, `external_owner`, `task_state`.

## 8. Command / bot UX (gợi ý)

- `/daily` — tóm tắt hôm nay (3 việc trọng tâm + lịch + chờ TVGS/BR).
- `/tasks` — xem 9 nhóm, lọc trạng thái.
- `/task W09` — xem hai cống riêng; cập nhật qua chat hoặc nút.
- `/waiting` — danh sách chờ TVGS và BR, lần hỏi gần nhất.
- `/calendar` — lịch hôm nay/mai và xung đột.
- `/done <id>` — không tự đóng nhóm nếu chỉ một tiểu mục xong; yêu cầu xác nhận khi thông tin mơ hồ.
- `/plan tomorrow` — đề xuất lịch dựa trên trạng thái thật, không lấp kín lịch không cần thiết.
- `/english` — gợi ý bài học 60 phút, kèm câu mở ChatGPT Voice; không mô phỏng khả năng tự bật Voice.
- `/snooze` — hoãn nhắc/buổi tập có điều kiện.

Ví dụ xử lý NLP:

1. `Đã xong MC 4100–4800 gửi TVGS` → cập nhật `W01.MC4100_4800` là `INTERNAL_DONE + SENT_FOR_REVIEW + AWAITING_FEEDBACK`, **KHÔNG** set `APPROVED`.
2. `BR đã giao bản vẽ trạm cân` → cập nhật `BR01` đã nhận hồ sơ theo đúng nội dung user báo; **KHÔNG** gộp `BR02…BR06`.
3. `Đã xong cống Km3+665` → cập nhật `W09.KM3_665` thôi; `W09.KM4_385` giữ nguyên.
4. `Mai đi công tác, dự kiến về trước 16h` → đánh dấu xung đột kế hoạch hành chính, hỏi/đề xuất dời; **không giả định** đã về.
5. `Hôm qua đau đầu chưa học` → buổi tiếng Anh hôm qua = `NOT_ATTENDED`, vẫn giữ recurring event cho các ngày sau.

## 9. Thuật toán nhắc việc hằng ngày

```text
on_scheduler_tick(local_time):
  local_time = convert_timezone(local_time, 'Asia/Ho_Chi_Minh')
  load tasks, sub_tasks, upcoming_calendar_events, external_followups
  apply confirmed updates in chronological order
  classify:
    A = in_progress
    B = not_started
    C = waiting_external(BR, TVGS)
    D = confirmed_done
  find conflicting/tentative events
  if business_day and time in [08:30, 11:45, 13:30, 16:30]:
      compose short report with context-specific question
  if time == 21:45:
      ask end-of-day updates, English attended?, tomorrow changes?
  send once per (user, trigger, local_date, notification_channel)
  log delivery and allow reschedule/undo
```

**Nội dung thông báo:** tin ngắn, có giờ chính xác, các công việc đã biết; tối đa 2–3 ưu tiên + các danh sách tồn đọng tóm gọn. Không lặp nguyên văn prompt dài; **không dùng thứ tự ưu tiên giả như hạn chót**.

## 10. Quy tắc tích hợp và an toàn

1. Bắt đầu bằng **audit hạ tầng hiện có**: Telegram bot, DB, scheduler, auth Google, các job đang chạy, timezone, command router, hệ thống log.
2. Nếu chưa có quyền Google Calendar, chạy **bot-only reminder**; không báo đã đồng bộ Calendar khi thực tế chưa.
3. Với lịch lặp, sửa một ngày ngoại lệ ở mức **single occurrence**, không vô tình sửa cả series.
4. Không trùng lịch từ các nguồn; dùng idempotency keys (user + event source ID + occurrence date + intent), retry an toàn.
5. Lịch nhắc **05:30** trên Calendar là popup, **không phải báo thức liên tục**. Nếu muốn alarm như app Đồng hồ iOS phải dùng cơ chế OS hỗ trợ hoặc hướng dẫn người dùng tự đặt; không hứa khả năng không có.
6. Không tự hứa đọc GPS/live location, giám sát TVGS/BR, đọc email công ty, hay điều khiển ChatGPT Voice nếu chưa có integration và quyền thực sự.
7. Không tự gửi tin nhắn/đôn đốc TVGS/BR nếu người dùng chỉ yêu cầu **nhắc bản thân hỏi tiến độ**.
8. Với đau đầu/mệt mỏi và việc tập lái: lời nhắc chỉ nên lưu điều kiện **đủ sức khỏe/tỉnh táo**, không hướng dẫn liều thuốc, không buộc lái.
9. Không đưa chi tiết nhạy cảm vào log công khai. Sử dụng env/config cho token, chat ID, webhook secret, Google OAuth.
10. Khi migrate, **không tự tắt** ChatGPT Automations hay sự kiện Calendar đang tồn tại; đề xuất kế hoạch cutover và xin duyệt sau chạy thử.

## 11. Luồng triển khai Codex (theo thứ tự)

1. **Inventory**: liệt kê file/thành phần YOOKOO Bot Daily hiện có, xác định nơi cần thay đổi, báo những integration còn thiếu.
2. **DB schema + seed**: migrate/cập nhật schema và nhập 9 nhóm, 6 BR subtask, 2 KCS cống, tình trạng TVGS; data seed idempotent.
3. **Scheduler**: chạy lịch 08:30/11:45/13:30/16:30 T2–T7 và 21:45 hằng ngày, có timezone, rate limit, dedupe.
4. **NLU + state transitions**: parse tin nhắn tiến độ thành structured update có xác nhận, lịch sử, rollback khi nhầm.
5. **Google Calendar sync**: đọc trước khi ghi, map IDs, không nhân đôi recurring events; xử lý một occurrence cho ngoại lệ.
6. **Telegram UI**: tin nhắc gọn, commands cập nhật, xem tồn đọng, waiting TVGS/BR, xem lịch, định dạng tiếng Việt.
7. **Tests**: unit cho trạng thái, recurrence, timezone, ngoại lệ, idempotency; integration với provider mock; chạy sandbox.
8. **Preview checkpoint**: trình bày screenshot/tin mẫu và log test, chờ người dùng phê duyệt trước khi bật tác vụ production hay thay nguồn nhắc cũ.

**Mục tiêu đầu ra của Codex:** các thay đổi code thực sự trong repo, migration idempotent, cấu hình `.env.example` không chứa secret, tests và tài liệu vận hành, demo 5 mốc thư ký, không thêm bot/hạ tầng ngoài nhu cầu.

## 12. Acceptance tests

- [ ] Ngày thứ Bảy vẫn có lịch hành chính; Chủ nhật không có nhắc ca KCS sáng/chiều.
- [ ] Reminder 08:30/11:45/13:30/16:30 chỉ T2–T7; 21:45 mỗi ngày, giờ Việt Nam.
- [ ] Trạng thái KCS MC4100–4800 = nội bộ xong, đã gửi TVGS, **chờ phản hồi**, không thành TVGS approved.
- [ ] Hai cống Km3+665 và Km4+385 theo dõi riêng, mỗi cống có trạng thái độc lập.
- [ ] 6 bộ BVTC có `owner=BR`, user chỉ monitor; bot không giao anh tự bóc tách.
- [ ] `BR06` chứa đúng 3 điều chỉnh NSH (phạm vi, BTN tăng, cừ tràm giảm do không dời cống).
- [ ] Có 5 việc **chưa bắt đầu**, không bị nhầm là đã làm xong.
- [ ] Ngoại lệ công tác 10/11 không làm biến mất KCS chưa xong và không tự xác nhận buổi tập lái.
- [ ] Lịch tập lái 10/11 có điều kiện “thực tế về trước 16:00 + đủ tỉnh táo”; các buổi tuần khác không bị thay đổi.
- [ ] Học tiếng Anh 20:00–21:00 mỗi ngày, buổi 09/11 chưa học; không tự mở Voice.
- [ ] Sửa một occurrence Google Calendar không sửa cả recurring series.
- [ ] Retry job 2 lần không gửi đôi thông báo và không tạo đôi event.
- [ ] Khi không có integration/credentials, bot báo rõ và hoạt động được phần offline; không báo đồng bộ thành công giả.
- [ ] Không tự tắt các lời nhắc hiện có trước khi người dùng xác nhận chuyển hẳn sang YOOKOO Bot Daily.

## 13. Prompt ngắn để đưa cho Codex

> **Đọc file `YOOKOO_BOT_DAILY_THU_KY_HANDOFF.md` này như tài liệu đặc tả.** Hãy khảo sát repo YOOKOO Bot Daily hiện tại trước, rồi tích hợp module Thư ký cá nhân tiếng Việt theo đúng các quy tắc, trạng thái, lịch và acceptance tests trong file. Tái dùng bot/scheduler/DB/Google Calendar integration có sẵn, tuyệt đối không tạo trùng lịch hoặc tự suy diễn hoàn thành. Ưu tiên kiến trúc tối giản, chạy ổn định, có test, preview và ghi rõ điểm nào thực hiện được/chưa được. Trước khi bật lịch production hoặc tắt nguồn nhắc cũ, trình bày kết quả kiểm thử để tôi duyệt.

---

**Nguồn đặc tả:** Các cập nhật và xác nhận của người dùng trong cuộc hội thoại về thư ký đến ngày 11/11/2026; không phải dữ liệu đọc trực tiếp từ DB của YOOKOO Bot Daily. Đây là bản bàn giao cho Codex, không xác nhận việc tích hợp đã diễn ra.
