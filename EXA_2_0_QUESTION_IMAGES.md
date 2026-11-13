# EXA 2.0 – Hình ảnh trong câu hỏi

- Tạo / sửa câu hỏi tại **Ngân hàng câu hỏi**: tải lên PNG/JPEG/WebP (≤ 5 MB) cho câu hỏi hoặc từng phương án A–D.
- Đáp án có thể chỉ là ảnh: hệ thống vẫn giữ phương án dù ô chữ trống.
- Xem ảnh trong ngân hàng, phòng thi, xem trước đề và trang kết quả. Xáo trộn phương án đồng bộ với ảnh.
- Backend lưu ảnh trong MySQL `question_media`, tên UUID khó đoán, URL hiển thị `/api/v1/question-media/{uuid}`; không phụ thuộc ổ cứng máy chủ.
- **Phải chạy Flyway migration V7** trước khi sử dụng. Sao lưu DB trước khi nâng cấp.
- Ảnh public qua URL khó đoán để học sinh xem được không cần token tải ảnh; tránh đưa nội dung bí mật vào ảnh. Có thể cần mở rộng kiểm soát quyền nếu dùng đề thi bảo mật cao.
- Ảnh tải lên nhưng chưa gắn vào câu hỏi vẫn được giữ trong DB; nên bổ sung garbage collection theo chính sách sử dụng thực tế.
- Nhập tài liệu Word/PDF không tự động tách hình ảnh nhúng; có thể thêm ảnh khi sửa câu hỏi sau khi import.
- Kiểm tra: tạo câu MCQ với ảnh, đổi thứ tự đáp án khi thi, thử làm bài và xem kết quả; thử câu tự luận có ảnh; xác nhận refresh vẫn giữ ảnh.
