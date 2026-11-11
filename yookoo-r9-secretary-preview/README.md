# YOOKOO R9 — Thư ký cá nhân (REVIEW CANDIDATE)

**Chưa triển khai Production.** Đây là mã tích hợp và preview để người dùng duyệt. Không gửi Telegram thật, không sửa Google Calendar và không tạo/tắt lời nhắc ChatGPT trong phiên này.

## Mở preview

Mở `preview/YOOKOO_PREVIEW.html` bằng trình duyệt. Không cần cài đặt, không cần mạng, không cần token. Nhắn “Đã xong cống Km3+665”, bấm Xác nhận: chỉ cống đó đổi trạng thái. Thử `/waiting`, “Mai tôi đi công tác”, `/calendar`, `/english`, hoặc chọn năm mốc giờ. Tải lại trang để reset phiên thử.

Preview chạy cùng module nghiệp vụ với Worker; dùng KV và metadata mô phỏng trong RAM. Nó **không gọi AI**. Trò chuyện mở qua OpenAI được viết trong adapter riêng, chỉ hoạt động sau khi cấu hình khóa và model. Kiểm thử DOM đã xác nhận các tương tác; kiểm tra hình ảnh bằng Chromium bị môi trường chặn socket nên chưa xác minh render bằng ảnh chụp trình duyệt.

## Đã tích hợp

- Cùng bot, endpoint `/telegram`, secret xác thực, chat ID, Worker và namespace `YOOKOO_KV` của R8.
- Giữ nguyên F4, I-130 chỉ là bản ghi + link, tin riêng đường Vành đai và các lệnh R8.
- 9 nhóm việc, một phạm vi MC 4100–4800, hai cống độc lập, sáu nhóm BR. Năm nhóm chưa bắt đầu đúng snapshot. BR là người thực hiện; bạn chỉ theo dõi.
- `/add work|personal tên việc`, `/tasks`, `/task`, `/waiting`, `/daily`, `/plan tomorrow`, `/history`, `/done`, `/undo`, `/snooze`, `/calendar`, `/event`, `/move`, `/english`.
- Câu tiếng Việt phổ biến được xử lý cục bộ. Câu khác chuyển qua Responses API khi có cấu hình. AI chỉ đề xuất, không tự ghi dữ liệu hoặc thực thi công cụ.
- Mọi thay đổi nghiệp vụ/lịch có màn đề xuất → `/confirm mã` hoặc `/cancel mã`; hết hạn sau một giờ; cập nhật cũ bị từ chối nếu mục đó đã thay đổi. Hoàn tác công việc không đè lên cập nhật mới hơn.
- Nhật ký sự kiện và snapshot trong KV hiện có, seed idempotent. Ngoại lệ không làm hoàn thành hoặc biến mất công việc gốc.
- Bộ điều phối Durable Object trong cùng Worker tuần tự hóa ghi dữ liệu, giữ con trỏ phiên bản, đề xuất và trạng thái giao nhận. Đây là **binding mới cần cấu hình**, không phải một bot hoặc kho công việc song song. Metadata điều phối sử dụng storage của Durable Object.
- Nhắc thư ký T2–T7 08:30, 11:45, 13:30, 16:30; 21:45 hằng ngày, giờ Việt Nam. F4/đường vẫn 08:30 hằng ngày như R8.
- `/event` khi chưa kết nối Calendar tạo đề xuất **lịch chỉ trong bot**, nhắc trước 15 phút sau khi xác nhận. Không báo đã đồng bộ Google.
- Nhắc Telegram thêm cho đưa/đón con, tập lái dự kiến và tiếng Anh có cờ `PERSONAL_REMINDERS`, mặc định tắt để không nhân thêm popup Calendar đã có. Lịch cá nhân vẫn xuất hiện trong báo cáo.
- Calendar có adapter OAuth, đọc toàn bộ trang sự kiện, đối chiếu các ID cũ, kiểm tra trùng lịch, tạo event ID ổn định khi retry. Dời lịch lặp chỉ sửa một instance với ETag, không sửa series.

## Chưa được xác minh trực tiếp

Chưa truy cập cấu hình Cloudflare Production, KV thật, quyền Google Calendar, model/API key thật hay giao nhận Telegram thật. Kết nối Calendar trong phiên hiện không được cài đặt. Kiểm kê ChatGPT trả về 0 automation mà phiên này nhìn thấy; điều đó không chứng minh các lời nhắc trong bản bàn giao đã bị xóa. Không thay đổi bất kỳ automation nào.

Google Calendar trong ChatGPT và OAuth dùng trong Worker là hai môi trường kết nối khác nhau: kết nối app ở ChatGPT giúp đối chiếu lịch, không tự cung cấp refresh token cho Worker. Tái dùng ứng dụng/OAuth đã được cấp quyền của bạn nếu có, không đăng ký lại hay tạo lại các sự kiện cũ chỉ vì thiếu quyền trong phiên này.

**Thông báo ChatGPT vẫn được giữ theo yêu cầu.** Telegram là kênh bổ sung. Dữ liệu KV của bot không tự trở thành bộ nhớ hoặc dữ liệu của các ChatGPT Automations. Bản này không hứa đồng bộ ngầm hai bên; có thể xem/copy `/daily`, `/tasks`, `/history` khi cần trao đổi ở ChatGPT.

## Cấu hình sau khi duyệt

Đọc `OPERATIONS.md` trước khi triển khai. **Không chỉ dán worker.js và Deploy như các bản chỉnh chữ trước:** R9 cần binding điều phối và thay lịch Cron có kiểm soát. File `wrangler.preview.jsonc` chỉ cho thử nghiệm, cố tình không có Cron và không chứa namespace ID thật.

Không gửi token/mật khẩu qua chat. Đặt secret trong Dashboard Worker hoặc hệ thống quản lý secret hiện hữu. Xem `.env.example`.

## Kiểm thử

```sh
npm run build
npm test
```

49/49 kiểm thử Node PASS; runtime workerd PASS với Durable Object storage thật trong sandbox và KV giả; preview DOM PASS. Mọi dịch vụ bên ngoài trong tests là mock. Xem `TEST_MATRIX.md` và `evidence/`.

Nguồn kỹ thuật đã đối chiếu:
- https://developers.cloudflare.com/kv/concepts/how-kv-works/
- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://developers.google.com/workspace/calendar/api/guides/create-events
- https://developers.google.com/workspace/calendar/api/guides/recurringevents
