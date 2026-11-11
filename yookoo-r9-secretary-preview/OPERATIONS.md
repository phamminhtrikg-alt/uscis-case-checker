# Kế hoạch triển khai — CHỈ THỰC HIỆN SAU KHI ĐƯỢC DUYỆT

## Trước triển khai

1. Giữ R8 đang chạy. Ghi lại deployment ID, Cron, namespace KV hiện hữu và cấu hình webhook. Không xuất token ra file bàn giao.
2. Xem HTML preview, thử 5 ví dụ acceptance, thống nhất phương án thêm Durable Object metadata. Không chạy deploy từ `wrangler.preview.jsonc` lên Production.
3. Kiểm tra gói Cloudflare hỗ trợ Durable Objects SQLite và chi phí thực tế. Chưa xác minh hạn mức tài khoản; không hứa toàn bộ nâng cấp miễn phí.
4. Điền đúng namespace ID hiện có cho `YOOKOO_KV`. Dùng cùng Worker `yookoo-daily-bot`. Tạo binding `SECRETARY_COORDINATOR`, class `SecretaryCoordinator`, migration `secretary-v1` một lần. Không tạo thêm namespace KV để chứa cùng dữ liệu công việc.
5. Khóa Telegram giữ nguyên. `TELEGRAM_ALLOWED_USER_ID` là ID cá nhân được phép cập nhật; mặc định bằng private chat ID. Không cho thành viên khác trong group sửa dữ liệu.
6. Cấu hình OpenAI API key + tên model hỗ trợ Responses structured output. Đây là kết nối API riêng; không dùng phiên đăng nhập ChatGPT làm token. Chưa có kiểm thử live hoặc đo chi phí của model.
7. Đối chiếu kết nối Google đã có. Tái dùng Calendar ID/OAuth/refresh token được cấp quyền; không tự tạo app hoặc lịch thay thế. Bắt đầu với `GOOGLE_WRITE_ENABLED=false`; `/calendar sync` chỉ đọc 9 ID tham chiếu. ID không đọc được ghi UNVERIFIED/NOT_FOUND, không tạo bản thay thế.

## Chạy thử có kiểm soát

- Cấu hình riêng môi trường kiểm thử, dữ liệu seed giả. `SECRETARY_MODE=preview` không gửi hoặc ghi Production. HTML đã chạy được không cần triển khai.
- Khi người dùng duyệt chạy thật, `SECRETARY_MODE=live`, `SECRETARY_REMINDERS=false` trước; thử `/tasks`, `/task W09`, proposal → confirm → undo trong một mục thử mới.
- Sau đó thử `/check`, xác nhận vẫn có F4/I-130 và tin đường riêng. `/case` không gọi USCIS.
- `GOOGLE_WRITE_ENABLED=true` chỉ sau khi kiểm tra quyền và đúng lịch. Thử dời một event thử, đối chiếu ID instance/ETag. Không dùng chuỗi thật làm thử nghiệm tùy tiện.
- Khi duyệt nhắc tự động: **thay** Cron cũ `30 1 * * *` bằng **một** `* * * * *`, không giữ cả hai. Cùng scheduler hiện có sẽ dispatch theo phút; R8 chỉ chạy ở 08:30 VN. Bật `SECRETARY_REMINDERS=true`.
- T2–T7: 08:30/11:45/13:30/16:30; 21:45 mỗi ngày. CN chỉ thư ký 21:45, F4/đường 08:30 vẫn giữ. Nhắc bot-only trước sự kiện 15 phút.
- `PERSONAL_REMINDERS=false` mặc định: không phát thêm nhắc đưa/đón/tập lái/tiếng Anh ngoài các báo cáo, vì Calendar đã có lịch. Chỉ bật true nếu người dùng muốn nhận thêm ở Telegram.
- Không thay đổi ChatGPT Automations; người dùng yêu cầu giữ chúng bình thường.

## Lỗi và khôi phục

- KEY/API/OAuth thiếu: phần dữ liệu/lệnh cục bộ vẫn hoạt động; hội thoại AI hoặc Calendar nói rõ chưa kết nối.
- KV mất kết nối hoặc chưa thấy bản ghi: không xác nhận đã lưu. Pending journal được phục hồi khi KV hoạt động trở lại.
- UNKNOWN delivery: không tự gửi lại; xem Telegram, gọi /daily hoặc /history bằng tin mới nếu cần đọc kết quả. Không coi timeout là chưa gửi.
- Event Calendar thay đổi ETag: tạo đề xuất mới sau khi đọc lại; không bỏ điều kiện kiểm tra.
- Tick trễ quá 5 phút hoặc lịch quá khứ: bỏ, không phát lại báo thức 10/11. Nếu muốn nhắc lại phải đặt lịch tương lai.
- Rollback: khôi phục deployment R8 và Cron `30 1 * * *`. Giữ nguyên KV và Durable Object namespace để không mất dữ liệu thư ký; không xóa metadata pending/delivery.

## Vận hành dài hạn

Theo dõi số lần AI, lỗi OAuth/KV, số UNKNOWN delivery và chi phí tick mỗi phút. Giới hạn hội thoại 12 yêu cầu/phút, timeout API, không ghi secret hoặc tin nhắn thô vào console. Dữ liệu công việc và hội thoại trong KV là riêng tư; hiện chưa tự hết hạn. Thiết lập retention/backup trước sử dụng lâu dài.

Không có endpoint xem task công khai. Root chỉ trả tên phiên bản; đường internal chỉ ở binding điều phối. Không có code tự sửa các ChatGPT Automations.
