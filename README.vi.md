# EXA — Exam Extra

[English](./README.md) | **Tiếng Việt**

EXA là nền tảng kiểm tra trực tuyến và quản lý lớp học hỗ trợ hoạt động dạy, học. Giáo viên có thể tổ chức lớp, xây dựng ngân hàng câu hỏi, tạo và giao đề thi, xem bài làm và sử dụng các công cụ AI hỗ trợ chuẩn bị học liệu. Học sinh tham gia bài thi đang mở, nộp câu trả lời và xem kết quả.

Website production: [exa-edulab.pages.dev](https://exa-edulab.pages.dev)

## Nội dung

- [Tính năng](#tính-năng)
- [Công nghệ](#công-nghệ)
- [Cấu trúc repository](#cấu-trúc-repository)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Chạy dự án local](#chạy-dự-án-local)
- [Cấu hình biến môi trường](#cấu-hình-biến-môi-trường)
- [Build và kiểm thử](#build-và-kiểm-thử)
- [Tổng quan API](#tổng-quan-api)
- [Triển khai production](#triển-khai-production)
- [Bảo mật và vận hành](#bảo-mật-và-vận-hành)
- [Tài liệu](#tài-liệu)

## Tính năng

### Dạy học và quản lý lớp

- Giao diện và chức năng phân quyền theo vai trò giáo viên, học sinh.
- Tạo lớp học, quản lý thành viên và chia sẻ mã tham gia lớp.
- Xây dựng ngân hàng câu hỏi có thể tái sử dụng.
- Tạo, xuất bản và quản lý đề thi, bài tập.
- Chia sẻ mã phòng thi hoặc liên kết mời học sinh.
- Xem bài nộp, chấm câu trả lời tự luận, phân tích kết quả đề thi và câu hỏi.
- Xuất các báo cáo được hỗ trợ để tiếp tục xử lý.

### Thi và đánh giá

- Hỗ trợ câu hỏi trắc nghiệm và tự luận.
- Lưu tiến độ làm bài và nộp bài để chấm điểm.
- Hiển thị công thức toán bằng `$...$` hoặc `\(...\)`, công thức hóa học bằng KaTeX mhchem, ví dụ `$\ce{H2O}$`.
- Gắn ảnh vào câu hỏi hoặc từng phương án trắc nghiệm. Khi xáo trộn phương án, ảnh vẫn đi cùng nội dung tương ứng.
- Lưu ảnh câu hỏi trong MySQL, không phụ thuộc ổ đĩa của một máy chủ ứng dụng cụ thể.
- Cho phép tiếp tục bài thi đang làm nếu đề được đóng sau khi học sinh đã bắt đầu.

### Công cụ AI và ExaBot

- Nhập tệp TXT, DOCX, PDF, XLSX, XLS, PNG, JPG/JPEG và WEBP tối đa 20 MB. Ảnh và PDF scan giới hạn 15 MB.
- Trích xuất câu hỏi từ tài liệu hoặc tạo câu hỏi từ ghi chú, chủ đề, bảng dữ liệu, thông tin hay nội dung được dán trực tiếp. Giáo viên có thể xem, sửa bản xem trước trước khi lưu.
- Sử dụng Gemini hoặc Groq cho các luồng nhập liệu AI tương ứng. Xử lý ảnh và PDF scan cần model hỗ trợ vision; luồng dự phòng PDF scan của Groq hỗ trợ tối đa ba trang.
- Hỏi ExaBot để được hỗ trợ học tập. Chat có thể chuyển sang các nhà cung cấp AI khác theo thứ tự cấu hình.
- ExaBot kiểm duyệt theo tài khoản: nhắc nhở ba lần với nội dung vi phạm được phát hiện, sau đó khóa chat 5 phút nếu tiếp tục vi phạm. Mỗi lượt chat cách nhau tối thiểu 7 giây.
- Hiển thị công thức và nội dung có định dạng trong chat, học liệu.

### Giám sát phòng thi

- Thu nhận sự kiện do trình duyệt báo cáo và cung cấp tổng quan theo lô để giáo viên xem xét.
- Sự kiện giám sát chỉ là tín hiệu cần kiểm tra, không phải bằng chứng vi phạm. Trạng thái tab, tiêu điểm cửa sổ, toàn màn hình hoặc clipboard có thể bị ảnh hưởng bởi thiết bị và trình duyệt.
- Không khẳng định tính năng có thể nhận diện danh tính hoặc tự kết luận gian lận chỉ từ các tín hiệu này.

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Java 21, Spring Boot 3, Spring Security |
| Cơ sở dữ liệu | MySQL 8, Flyway migrations, Spring Data JPA |
| Tích hợp AI | Gemini, Groq và các nhà cung cấp tương thích OpenAI tùy chọn |
| Hosting production | Cloudflare Pages (frontend), Railway (backend) |

## Cấu trúc repository

```text
.
├── backend/
│   ├── src/main/java/vn/exa/       # Ứng dụng Spring Boot
│   ├── src/main/resources/         # Cấu hình và Flyway migrations
│   ├── src/test/                   # Kiểm thử backend
│   └── Dockerfile
├── frontend/
│   ├── src/api/                    # API clients và kiểu dữ liệu
│   ├── src/components/             # UI dùng chung, bao gồm ExaBot
│   ├── src/hooks/                  # React hooks dùng chung
│   └── src/pages/                  # Các trang ứng dụng
├── docs/
│   ├── API.md                      # Tổng quan các nhóm API
│   └── deployment.md               # Hosting và biến môi trường
├── docker-compose.yml              # MySQL, backend và Nginx
├── railway.toml                    # Cấu hình build/health check Railway
├── README.md                       # Hướng dẫn tiếng Anh
└── README.vi.md                    # Hướng dẫn tiếng Việt
```

## Yêu cầu môi trường

- Node.js và npm (khuyến nghị bản LTS hiện hành).
- Java 21.
- Maven 3.9 trở lên.
- MySQL 8. Có thể dùng Docker Desktop để chạy MySQL local bằng cấu hình có sẵn.

## Chạy dự án local

### 1. Cấu hình và chạy MySQL

Tại thư mục gốc repository, sao chép file môi trường mẫu rồi thay toàn bộ mật khẩu và secret mẫu bằng giá trị riêng:

```powershell
Copy-Item .env.example .env
```

Chỉ khởi động dịch vụ cơ sở dữ liệu:

```powershell
docker compose up -d mysql
```

Backend đọc biến môi trường trực tiếp, không tự động nạp file `.env` ở thư mục gốc. Trong cùng cửa sổ PowerShell, cấu hình kết nối local và JWT secret riêng:

```powershell
$env:SPRING_PROFILES_ACTIVE = "dev"
$env:DB_HOST = "localhost"
$env:DB_PORT = "3306"
$env:DB_NAME = "exa"
$env:DB_USER = "exa"
$env:DB_PASSWORD = "thay-bang-gia-tri-trong-.env"
$env:JWT_SECRET = "thay-bang-secret-ngau-nhien-rieng-it-nhat-32-byte"
$env:CORS_ORIGINS = "http://localhost:3000,http://localhost:5173"
```

Flyway tự chạy database migrations khi backend khởi động. Hibernate kiểm tra cấu trúc bảng; production không tự động tạo hoặc cập nhật schema.

### 2. Chạy backend

Mở terminal đã cấu hình các biến môi trường backend:

```powershell
Set-Location backend
mvn spring-boot:run
```

API chạy tại `http://localhost:8080/api`. Health endpoint là `http://localhost:8080/api/actuator/health`.

### 3. Chạy frontend

Mở terminal khác:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Vite chạy tại `http://localhost:3000` và mặc định proxy yêu cầu `/api` tới `http://localhost:8080`. Nếu backend ở địa chỉ khác, cấu hình `VITE_API_PROXY_TARGET` trong môi trường chạy/build frontend.

Đăng nhập Google là tùy chọn. Để bật khi phát triển local, sao chép `frontend/.env.example` thành `frontend/.env.local` và cấu hình Firebase Web app. Backend cũng cần `FIREBASE_PROJECT_ID` và thông tin xác thực Firebase Admin.

## Cấu hình biến môi trường

Giữ secret trong môi trường local hoặc kho bí mật của nhà cung cấp hosting. Không commit `.env`, API key, Firebase service-account credentials, mật khẩu database hoặc JWT secret.

### Backend

| Biến | Mục đích |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | Chọn profile, ví dụ `dev` hoặc `prod`. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Kết nối MySQL cho profile local/mặc định. |
| `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD` | Kết nối MySQL production; thường do Railway cung cấp. |
| `JWT_SECRET` | Secret ký token. Dùng giá trị ngẫu nhiên riêng tối thiểu 32 byte. |
| `CORS_ORIGINS` | Danh sách origin frontend, phân tách bằng dấu phẩy, có scheme và không có path. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Khóa truy cập Gemini và lựa chọn model tùy chọn. |
| `GROQ_API_KEY`, `GROQ_MODEL` | Khóa truy cập Groq và lựa chọn model tùy chọn. Model phải hỗ trợ vision cho tác vụ ảnh/PDF scan. |
| `EXABOT_PROVIDER_ORDER` | Thứ tự ưu tiên ExaBot; mặc định `gemini,openrouter,openai,groq,deepseek`. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Nhà cung cấp chat OpenRouter tùy chọn. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Nhà cung cấp chat tương thích OpenAI tùy chọn. |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` | Nhà cung cấp chat DeepSeek tùy chọn. |
| `EXABOT_TIMEOUT_MS` | Timeout cho provider ExaBot tương thích; mặc định 25000 ms. |
| `FIREBASE_PROJECT_ID` | Firebase project dùng để xác minh đăng nhập Google. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON service account Firebase Admin riêng tư, tùy chọn nếu nền tảng không cấp credentials. |

ExaBot chỉ sử dụng provider đã cấu hình và được bật trong `EXABOT_PROVIDER_ORDER`. Tình trạng, hạn mức và chi phí của provider phụ thuộc nhà cung cấp tương ứng. Lựa chọn provider khi nhập câu hỏi AI độc lập với thứ tự ưu tiên ExaBot.

### Frontend

| Biến | Mục đích |
| --- | --- |
| `VITE_API_URL` | URL API backend công khai, gồm `/api`, dùng khi build production. Trên Cloudflare Pages phải dùng HTTPS. |
| `VITE_API_PROXY_TARGET` | Origin backend cho Vite proxy local `/api`; mặc định `http://localhost:8080`. |
| `VITE_FIREBASE_API_KEY` | Cấu hình Firebase Web app cho đăng nhập Google. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domain xác thực Firebase Web app. |
| `VITE_FIREBASE_PROJECT_ID` | Project ID của Firebase Web app. |
| `VITE_FIREBASE_APP_ID` | App ID của Firebase Web app. |

Các giá trị `VITE_*` được nhúng vào bundle trình duyệt, không phải nơi lưu bí mật. Không đặt provider key hoặc service-account credentials trong biến frontend.

## Build và kiểm thử

Frontend:

```powershell
Set-Location frontend
npm ci
npm run build
npm run lint
```

Backend:

```powershell
Set-Location backend
mvn test
```

Build container backend từ thư mục gốc:

```powershell
docker build -f backend/Dockerfile -t exa-backend .
```

## Tổng quan API

Backend cung cấp JSON API dưới `/api`. Route yêu cầu xác thực nhận bearer token trong header `Authorization`. Response thành công dùng cấu trúc chung `{ success, message, data, timestamp }`.

| Nhóm route | Mục đích |
| --- | --- |
| `/api/v1/auth` | Đăng ký, đăng nhập và thông tin người dùng hiện tại |
| `/api/v1/users/me` | Hồ sơ và cài đặt mật khẩu |
| `/api/v1/classrooms` | Lớp học, thành viên và mã tham gia |
| `/api/v1/questions` | Ngân hàng câu hỏi, tìm kiếm, nhập liệu và thao tác hàng loạt |
| `/api/v1/exams` | Tạo đề, xuất bản và sắp xếp câu hỏi |
| `/api/v1/submissions` | Lượt làm bài, câu trả lời, chấm điểm, kết quả và sự kiện giám sát |
| `/api/v1/reports` | Báo cáo đề thi, phân tích câu hỏi và xuất dữ liệu |
| `/api/v1/imports` | Tải lên, AI trích xuất/tạo câu hỏi, xem trước và lưu |
| `/api/v1/ai` | Tạo câu hỏi AI, gợi ý chấm tự luận và chat ExaBot |
| `/api/actuator/health` | Kiểm tra trạng thái dịch vụ |

Xem [docs/API.md](./docs/API.md) để biết tổng quan route. Khi được bật, ứng dụng đang chạy cũng cung cấp tài liệu OpenAPI/Swagger.

## Triển khai production

### Frontend — Cloudflare Pages

1. Chọn `frontend` làm thư mục gốc của Pages project.
2. Build command là `npm run build`, thư mục output là `dist`.
3. Đặt `VITE_API_URL` là URL Railway backend kèm `/api`, ví dụ `https://your-service.up.railway.app/api`.
4. Nếu bật đăng nhập Google, cấu hình các biến build `VITE_FIREBASE_*`.
5. Thêm hostname Pages vào danh sách authorized domains của Firebase Authentication.

Frontend production: [exa-edulab.pages.dev](https://exa-edulab.pages.dev).

### Backend — Railway

1. Deploy từ thư mục gốc repository và dùng `railway.toml`. Không đặt service root directory là `backend`, vì Docker build context là thư mục gốc.
2. Cấu hình `SPRING_PROFILES_ACTIVE=prod`, các biến kết nối `MYSQL*`, `JWT_SECRET` riêng tư, `CORS_ORIGINS` chính xác và các biến AI/Firebase cần thiết.
3. Dùng MySQL riêng tư, có persistence. Flyway chạy migrations khi ứng dụng khởi động; chờ ứng dụng và health check thành công.
4. Gắn persistent volume tại `/app/uploads` nếu cần giữ file import qua các lần restart hoặc deploy.

Health check Railway là `/api/actuator/health`. Xem [docs/deployment.md](./docs/deployment.md) để cấu hình provider, giới hạn import và hướng dẫn production chi tiết.

### Docker Compose

File `docker-compose.yml` ở thư mục gốc mô tả stack MySQL, backend và Nginx. Stack này cần `.env` gốc đã cấu hình, frontend build sẵn ở `frontend/dist` và thông số triển khai hợp lệ. Khi phát triển frontend local, chỉ chạy dịch vụ `mysql` như hướng dẫn ở trên, không khởi động toàn bộ stack hướng production.

## Bảo mật và vận hành

- Dùng secret mạnh, riêng biệt và kết nối database riêng tư. Production chỉ cho phép các origin HTTPS đáng tin cậy trong `CORS_ORIGINS`.
- Không commit credentials hoặc tải dữ liệu người học riêng tư lên AI provider nếu tổ chức chưa xem xét điều khoản quyền riêng tư và lưu trữ dữ liệu của nhà cung cấp.
- Câu hỏi và đáp án do AI tạo chỉ là gợi ý. Giáo viên cần kiểm tra độ chính xác, tính phù hợp trước khi giao bài.
- Tệp nhập bị giới hạn định dạng và dung lượng; không gửi tài liệu mà người dùng không được phép chia sẻ tới AI service đã cấu hình.
- Sự kiện giám sát là tín hiệu do trình duyệt báo cáo, có thể không chính xác; không dùng riêng chúng làm bằng chứng kết luận.
- Khi vận hành production, cần theo dõi sao lưu database, nơi lưu file, mức sử dụng AI provider và health của dịch vụ.

## Tài liệu

- [English project guide](./README.md)
- [Tổng quan API](./docs/API.md)
- [Triển khai và cấu hình môi trường](./docs/deployment.md)
