# Kết quả kiểm thử

49/49 Node tests PASS. Runtime workerd PASS với Durable Object storage thật, namespace nội bộ và KV giả. Preview DOM PASS: 18 task, xác nhận chỉ một cống, chọn bản tin 21:45, không có request bên ngoài. Browser screenshot bị chặn bởi môi trường socket; không ghi nhận visual-render PASS.

| Acceptance | Kết quả trong mô phỏng |
|---|---|
| T7 hành chính, CN chỉ thư ký tối | PASS |
| 5 mốc đúng giờ Việt Nam | PASS |
| MC 4100–4800 nội bộ xong, chờ TVGS | PASS |
| Cống độc lập, không tự đóng cha | PASS |
| 6 BR owner BR, monitor, đúng NSH và “công phát sinh” | PASS |
| 5 nhóm chưa bắt đầu | PASS |
| Công tác giữ công việc, chưa suy ra đã về | PASS |
| Tập lái có điều kiện 10/11, T7 đúng 16:45 | PASS |
| Tiếng Anh 09/11 chưa học, không tự Voice | PASS |
| Dời một occurrence không sửa series | PASS mock Google |
| Retry đã xác nhận không gửi/tạo đôi | PASS; timeout không rõ kết quả lưu UNKNOWN, không tuyên bố exactly-once |
| Thiếu kết nối: không giả đồng bộ | PASS |
| Giữ ChatGPT/Calendar hiện hữu | Không có thao tác mutation với các hệ thống đó trong phiên |
| F4/I-130/đường và cảnh báo R8 | 20 regression tests PASS |
| Thêm việc cá nhân, lịch bot-only | PASS |

## Phạm vi chưa kiểm chứng

Chưa deploy, chưa đọc KV Production, chưa dùng OAuth thật, chưa gọi OpenAI bằng khóa/model thật, chưa nhận xác nhận Telegram thật, chưa đo CPU/chi phí Free plan. Không có bằng chứng Calendar ID thật còn tồn tại hay ChatGPT Automations thực sự đang bật. Tất cả module cần smoke test theo OPERATIONS sau khi người dùng duyệt và kết nối được cấp quyền.

File `evidence/tests.tap` là log cuối cùng. `evidence/workerd-test.txt` là log runtime. `evidence/preview-dom.txt` là log tương tác preview. `evidence/browser-render-blocked.txt` ghi giới hạn render. Fixture F4 từ bản R8, không phải lịch mới vừa đọc trong phiên này. Các ngày tháng 12 ở regression là giả lập.
