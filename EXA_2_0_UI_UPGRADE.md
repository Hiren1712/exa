# EXA 2.0 — UI/UX upgrade (12-11-2026)

## Đã thay đổi

- `frontend/src/components/Layout.tsx`: sidebar rộng và dễ thao tác hơn trên điện thoại; nút đóng menu, phím Escape, focus quay về nút mở; tiêu đề thanh công cụ theo trang; skip link cho bàn phím; safe-area support và chiều cao `dvh`.
- `frontend/src/pages/Dashboard.tsx`: tiêu đề và mô tả vai trò, hero đồng nhất, thẻ số liệu loading skeleton, hàng bài thi thích ứng màn hình nhỏ, empty state đúng theo giáo viên/học sinh.
- `frontend/src/pages/ExamRoom.tsx`: thanh điều hướng câu hỏi ngang trên thiết bị nhỏ, số câu đã trả lời, nút câu tối thiểu 44px, bố cục thi linh hoạt, ô tự luận có màu chữ/nền cả sáng lẫn tối.
- `frontend/src/index.css`: CSS token cho vùng hiển thị, focus, hiệu ứng dịu, chú ý reduced motion và safe-area.
- `frontend/src/components/Layout.tsx`: khi menu sidebar đóng trên màn hình nhỏ, ẩn khỏi cây trợ năng và loại các liên kết khỏi thứ tự focus; khi đóng menu, focus trở về nút mở.
- `frontend/src/components/ExaBot.tsx` và `frontend/src/components/ChatWidget.tsx`: tạo mascot đầu robot pixel riêng cho EXA và dùng thống nhất ở nút mở, đầu chat, trạng thái trống và biểu tượng phản hồi.

## Phạm vi

Frontend-only; giữ nguyên các route, endpoint API, nghiệp vụ, backend, database và authentication. Không tự động đẩy production.

## Kiểm tra đã thực hiện

- `npm run build` — PASS.
- `npm run lint` — PASS.
- Kiểm tra browser: 11 route giáo viên ở viewport 320, 375, 768 và 1024 px không tràn ngang; trang đăng nhập kiểm tra ở 320, 375, 768 và 1440 px.
- Preview local xác nhận sidebar mobile đóng có `inert`/`aria-hidden`, không nhận focus bàn phím; Enter mở menu, Escape đóng và khôi phục focus; sidebar desktop không bị vô hiệu hóa.
- Cloudflare production vẫn là bản trước sửa: trên production, Shift+Tab từ nút menu tập trung vào liên kết ngoài màn hình. Workspace hiện không có Git repository để đẩy thay đổi lên Cloudflare.
- Chưa có tài khoản học sinh/Pro để kiểm tra mọi thao tác nghiệp vụ và quyền truy cập; chưa đo Lighthouse hoặc WCAG đầy đủ.

## Hướng dẫn chạy

```powershell
cd frontend
npm ci
npm run build
npm run lint
npm run dev
```

Sau khi chạy, kiểm tra trực tiếp tại viewport 320, 375, 768, 1024 và 1440px; test keyboard sidebar, chọn câu/nộp bài, light/dark, đăng nhập và role STUDENT/TEACHER.

## Tích hợp

1. Sao lưu repository đang dùng hoặc tạo nhánh mới.
2. Giải nén gói này, so sánh các file thay đổi với code hiện tại.
3. Chạy `npm ci`, `npm run build`, `npm run lint` trên Windows/dev CI.
4. Test luồng thi có giám sát trước khi deploy production.

Đây là bản nâng cấp UI/UX có phạm vi rõ ràng, không phải xác nhận hoàn tất toàn bộ EXA 2.0 về tính năng, dữ liệu hay bảo mật.
