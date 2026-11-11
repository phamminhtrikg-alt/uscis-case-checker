# Kiểm kê và quyết định kiến trúc

## Hiện trạng quan sát được

| Thành phần | Bằng chứng | Cách xử lý |
|---|---|---|
| Worker R8 | Mã hiện có trong workspace; router `/telegram`, secret SHA-256 token | Giữ router xác thực, tái dùng Telegram provider và mã R8 dưới `src/legacy.js` |
| KV | Binding `YOOKOO_KV`; visa snapshot/delivery + road seen | Không tạo namespace công việc khác; chỉ thêm tiền tố `secretary:v1:` |
| Scheduler | `scheduled()` + Cron 30 1 * * * trong bàn giao | Cùng handler; sau duyệt thay Cron cũ bằng một tick mỗi phút để phục vụ cả lịch mới và nhắc sự kiện tùy giờ |
| Calendar | Không có adapter trong R8; bàn giao liệt kê 9 event ID | Adapter dùng ID cũ; đọc và đối chiếu, không seed bằng insert |
| ChatGPT | Có ID tham chiếu trong handoff; công cụ phiên này nhìn thấy 0 | Không tạo lại, không tắt, không đổi |
| AI hội thoại | Không có trong R8 | Responses API, context ngắn từ KV, output cấu trúc, mọi mutation phải xác nhận |
| Giao nhận/concurrency | KV không có atomic compare-and-set; không thể khóa liên vùng bằng KV | Thêm một Durable Object cho chủ bot trong cùng Worker. Không dùng khóa giả trong KV |

## Luồng

Telegram → kiểm tra webhook/chat/sender → cùng coordinator → router R8 hoặc thư ký → proposal/confirm → journal KV → phản hồi.

Cron → cùng coordinator → quy đổi giờ Việt Nam → lịch R8 08:30 + slot thư ký hoặc nhắc bot-only → delivery key theo ngày/slot/kênh.

Calendar → adapter dùng quyền hiện hữu → đọc trước → proposal → confirm → đọc lại ETag/ID → ghi một event/instance → lưu binding, timezone, recurrence, operation ID.

## Dữ liệu

- `secretary:v1:seed`: snapshot khởi tạo bất biến. Không sửa key R8.
- `secretary:v1:event:<operation>`: event nghiệp vụ append-only, có ngày, nguồn, target, before/patch.
- `secretary:v1:snapshot:<revision>`: checkpoint sau 100 event; giữ lịch sử để truy vết.
- Metadata Durable Object: con trỏ checkpoint/event, pending journal intent, proposal, turn receipt, delivery receipt, rate counter. Đây là metadata giao dịch bổ sung; không dựng DB thứ hai chứa bản sao các task hiện hành.
- Mọi đọc/ghi thư ký đi qua cùng đối tượng điều phối. Nếu KV chưa nhìn thấy event đã commit, từ chối trả trạng thái mới thay vì trả bản cũ rồi ghi đè.
- Không sửa trực tiếp key thư ký bằng Dashboard khi bot đang hoạt động; tránh phá thứ tự journal.

## Quy tắc giao nhận

Không thể bảo đảm exactly-once với Telegram khi mất mạng sau lúc máy chủ đã nhận tin. Bản này lưu SENDING trước gửi và SENT sau xác nhận. Nếu không biết kết quả, ghi UNKNOWN và không tự gửi lại để tránh tin đôi. Người dùng có thể gọi lệnh đọc lại bằng một tin mới. Lịch sử trạng thái vẫn được giữ. Trường hợp UNKNOWN cần kiểm tra Telegram/metadata, không tự xóa receipt rồi gửi lại.

Retry đã biết thành công không gửi lại; append nghiệp vụ có cùng operation ID không cập nhật lại. Các event Calendar mới có ID hash ổn định; 409 được đọc lại và đối chiếu. Sửa event dùng ETag và operation marker. Lịch mới do người dùng tự thêm sau preview được kiểm tra trùng khi commit.

## Giới hạn có chủ ý

- Không tự gửi cho BR/TVGS; mọi nhắc là nhắc chính người dùng.
- Không tự bật Voice, lấy GPS, đọc email hoặc biết người dùng đã về/đã học.
- Không tự sửa lịch cá nhân khi công tác/ốm; đánh dấu ngoại lệ công việc, yêu cầu xác nhận trước dời Calendar.
- `/snooze` hiện là hoãn kế hoạch hành chính một ngày; dời một buổi Calendar dùng `/move`, không ngầm sửa series.
- Chưa có speech-to-text hoặc xử lý ảnh/voice note Telegram. Bản preview hỗ trợ hội thoại bằng văn bản.
- Không có web search trong adapter hội thoại; nguồn tin F4/đường đi qua các module R8 riêng.
- Chat context tối đa 6 lượt hội thoại trước, không phải toàn bộ lịch sử tài khoản ChatGPT. Journal chưa có cơ chế tự xóa dữ liệu theo thời hạn; cần chính sách lưu giữ trước vận hành dài hạn.
