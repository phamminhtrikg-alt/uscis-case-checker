# USCIS Case Checker

Chạy trên máy tính của bạn. Script mở USCIS bằng Microsoft Edge, điền receipt và đọc kết quả đang hiển thị. Nếu có CAPTCHA/Cloudflare, bạn xử lý thủ công trong cửa sổ đó; script không vượt hoặc tự động hóa bước bảo vệ.

## Cài đặt

    cd uscis-case-checker
    npm install
    npm run check

## Tra cứu và lưu cục bộ

    npm run case -- --receipt IOE8434753880

Kết quả nằm trong .case-results/. Profile trình duyệt nằm trong .uscis-browser-profile/; cả hai đều bị loại khỏi Git bằng .gitignore.

## Gửi về Worker

Trong Telegram gửi /case browser để lấy nonce dùng một lần, sau đó chạy:

    npm run case -- --receipt IOE8434753880 --worker-url https://yookoo-daily-bot.phamminhtrikg.workers.dev --nonce NONCE_NHAN_TU_BOT

Chỉ receipt, tiêu đề, nội dung kết quả, URL USCIS và thời gian đọc được gửi. Không gửi cookie, mật khẩu, token hoặc profile.

## GitHub

GitHub lưu mã và chạy kiểm tra cú pháp. Không chạy tra cứu USCIS trên GitHub Actions để cố vượt Cloudflare/CAPTCHA; runner không có phiên trình duyệt của bạn và thường bị USCIS chặn.

Muốn bấm Run workflow trên GitHub thì dùng workflow Run USCIS case check on my computer với self-hosted Windows runner của chính bạn. Runner phải chạy trong phiên desktop đang đăng nhập để Edge hiện ra. Không dùng GitHub-hosted runner cho việc này. CAPTCHA/Cloudflare vẫn do bạn xử lý thủ công.
