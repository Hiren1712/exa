-- ============================================================
-- EXA Platform — Seed Data
-- Mật khẩu của tất cả tài khoản mẫu: password
-- Hash BCrypt của "password" với strength 10
-- ============================================================

-- Admin
INSERT INTO users (email, password_hash, full_name, role, plan, is_active, email_verified)
VALUES (
    'admin@exa.vn',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Quản trị viên',
    'ADMIN',
    'ENTERPRISE',
    TRUE,
    TRUE
);

-- Teacher
INSERT INTO users (email, password_hash, full_name, role, plan, is_active, email_verified)
VALUES (
    'teacher@exa.vn',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Cô Nguyễn Thu Trang',
    'TEACHER',
    'PRO',
    TRUE,
    TRUE
);

-- Student
INSERT INTO users (email, password_hash, full_name, role, plan, is_active, email_verified)
VALUES (
    'student@exa.vn',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Nguyễn Minh Anh',
    'STUDENT',
    'FREE',
    TRUE,
    TRUE
);

-- Lớp mẫu
INSERT INTO classrooms (teacher_id, name, code, subject, grade, description)
SELECT id, '12A1 — Toán', 'EXA-12A1', 'Toán', 12, 'Lớp chuyên Toán 12'
FROM users WHERE email = 'teacher@exa.vn';

INSERT INTO classrooms (teacher_id, name, code, subject, grade, description)
SELECT id, '12A2 — Vật Lý', 'EXA-12A2', 'Vật Lý', 12, 'Lớp chuyên Lý 12'
FROM users WHERE email = 'teacher@exa.vn';

-- Câu hỏi mẫu
INSERT INTO questions (owner_id, subject, grade, unit, difficulty, type, content, options, correct_answer, explanation)
SELECT
    id,
    'Toán', 12, 'Hàm số', 'RECOGNITION', 'MCQ',
    'Tập xác định của hàm số y = (2x - 1)/(x + 3) là:',
    JSON_ARRAY('A. ℝ \\ {3}', 'B. ℝ \\ {-3}', 'C. ℝ \\ {1/2}', 'D. ℝ'),
    'B',
    'Hàm số xác định khi x + 3 ≠ 0 ⇔ x ≠ -3'
FROM users WHERE email = 'teacher@exa.vn';

INSERT INTO questions (owner_id, subject, grade, unit, difficulty, type, content, options, correct_answer, explanation)
SELECT
    id,
    'Toán', 12, 'Hàm số', 'COMPREHENSION', 'MCQ',
    'Cho hàm số y = x³ - 3x² + 2. Hàm số đạt cực tiểu tại điểm nào?',
    JSON_ARRAY('A. x = 0', 'B. x = 2', 'C. x = -2', 'D. x = 1'),
    'B',
    'y'' = 3x² - 6x = 3x(x - 2). Đổi dấu âm sang dương khi qua x = 2'
FROM users WHERE email = 'teacher@exa.vn';

INSERT INTO questions (owner_id, subject, grade, unit, difficulty, type, content, options, correct_answer, explanation)
SELECT
    id,
    'Vật Lý', 12, 'Dao động cơ', 'APPLICATION', 'MCQ',
    'Một con lắc lò xo có k = 100 N/m, m = 250 g. Chu kỳ dao động riêng là:',
    JSON_ARRAY('A. 0,314 s', 'B. 0,628 s', 'C. 0,157 s', 'D. 1,256 s'),
    'A',
    'T = 2π√(m/k) = 2π√(0,25/100) ≈ 0,314 s'
FROM users WHERE email = 'teacher@exa.vn';

INSERT INTO questions (owner_id, subject, grade, unit, difficulty, type, content, options, correct_answer, explanation)
SELECT
    id,
    'Hoá Học', 12, 'Este - Lipit', 'RECOGNITION', 'TRUE_FALSE',
    'Este no, đơn chức, mạch hở có công thức tổng quát là CnH2nO2 (n ≥ 2).',
    JSON_ARRAY('A. Đúng', 'B. Sai'),
    'A',
    'Đúng. Este no đơn chức mạch hở có CTTQ CnH2nO2 với n ≥ 2.'
FROM users WHERE email = 'teacher@exa.vn';