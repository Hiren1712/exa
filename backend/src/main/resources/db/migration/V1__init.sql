-- ============================================================
-- EXA Platform — Schema v1
-- MySQL 8.0, utf8mb4
-- ============================================================

-- ==================== USERS ====================
CREATE TABLE users (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    email           VARCHAR(191) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    phone           VARCHAR(20),
    avatar_url      VARCHAR(500),
    date_of_birth   DATE,
    role            ENUM('ADMIN','TEACHER','STUDENT') NOT NULL,
    plan            ENUM('FREE','PRO','ENTERPRISE') NOT NULL DEFAULT 'FREE',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL,
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CLASSROOMS ====================
CREATE TABLE classrooms (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    teacher_id      BIGINT UNSIGNED NOT NULL,
    name            VARCHAR(120) NOT NULL,
    code            VARCHAR(20) NOT NULL UNIQUE,
    subject         VARCHAR(60),
    grade           INT,
    description     TEXT,
    max_students    INT NOT NULL DEFAULT 100,
    is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL,
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    INDEX idx_classroom_teacher (teacher_id),
    INDEX idx_classroom_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classroom_members (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    classroom_id    BIGINT UNSIGNED NOT NULL,
    student_id      BIGINT UNSIGNED NOT NULL,
    student_code    VARCHAR(20),
    status          ENUM('PENDING','ACTIVE','REMOVED') NOT NULL DEFAULT 'PENDING',
    joined_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_class_student (classroom_id, student_id),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_member_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== QUESTIONS ====================
CREATE TABLE questions (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    owner_id        BIGINT UNSIGNED NOT NULL,
    subject         VARCHAR(60) NOT NULL,
    grade           INT,
    unit            VARCHAR(120),
    difficulty      ENUM('RECOGNITION','COMPREHENSION','APPLICATION','HIGH_APPLICATION') NOT NULL,
    type            ENUM('MCQ','TRUE_FALSE','SHORT_ANSWER','ESSAY') NOT NULL,
    content         TEXT NOT NULL,
    content_html    MEDIUMTEXT,
    options         JSON,
    correct_answer  VARCHAR(10),
    answer_text     TEXT,
    explanation     TEXT,
    source          VARCHAR(200),
    is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    usage_count     INT NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id),
    INDEX idx_q_subject_grade (subject, grade),
    INDEX idx_q_difficulty (difficulty),
    INDEX idx_q_type (type),
    INDEX idx_q_owner (owner_id),
    FULLTEXT INDEX ft_q_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== EXAMS ====================
CREATE TABLE exams (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    owner_id        BIGINT UNSIGNED NOT NULL,
    classroom_id    BIGINT UNSIGNED,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    subject         VARCHAR(60),
    duration_min    INT NOT NULL,
    total_points    DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    status          ENUM('DRAFT','SCHEDULED','OPEN','CLOSED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    starts_at       DATETIME,
    ends_at         DATETIME,
    password_hash   VARCHAR(255),
    shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
    shuffle_options   BOOLEAN NOT NULL DEFAULT TRUE,
    proctor_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    lock_screen       BOOLEAN NOT NULL DEFAULT TRUE,
    max_attempts      INT NOT NULL DEFAULT 1,
    show_answer_after VARCHAR(20) NOT NULL DEFAULT 'AFTER_SUBMIT',
    metadata        JSON,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    INDEX idx_exam_owner (owner_id),
    INDEX idx_exam_class (classroom_id),
    INDEX idx_exam_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE exam_questions (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    exam_id         BIGINT UNSIGNED NOT NULL,
    question_id     BIGINT UNSIGNED NOT NULL,
    order_index     INT NOT NULL,
    points          DECIMAL(5,2) NOT NULL,
    UNIQUE KEY uk_exam_question (exam_id, question_id),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id),
    INDEX idx_eq_exam (exam_id),
    INDEX idx_eq_order (exam_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== SUBMISSIONS ====================
CREATE TABLE submissions (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    exam_id         BIGINT UNSIGNED NOT NULL,
    student_id      BIGINT UNSIGNED NOT NULL,
    attempt_number  INT NOT NULL DEFAULT 1,
    started_at      DATETIME NOT NULL,
    submitted_at    DATETIME,
    duration_sec    INT,
    total_score     DECIMAL(5,2),
    status          ENUM('IN_PROGRESS','SUBMITTED','GRADED','AUTO_SUBMITTED') NOT NULL DEFAULT 'IN_PROGRESS',
    is_flagged      BOOLEAN NOT NULL DEFAULT FALSE,
    proctor_summary JSON,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_exam_student_attempt (exam_id, student_id, attempt_number),
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    INDEX idx_sub_exam (exam_id),
    INDEX idx_sub_student (student_id),
    INDEX idx_sub_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE submission_answers (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    submission_id   BIGINT UNSIGNED NOT NULL,
    question_id     BIGINT UNSIGNED NOT NULL,
    answer_data     JSON,
    is_correct      BOOLEAN,
    points_earned   DECIMAL(5,2),
    teacher_note    TEXT,
    graded_by       BIGINT UNSIGNED,
    graded_at       DATETIME,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (graded_by) REFERENCES users(id),
    UNIQUE KEY uk_sub_question (submission_id, question_id),
    INDEX idx_sa_sub (submission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== PROCTOR ====================
CREATE TABLE proctor_events (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    submission_id   BIGINT UNSIGNED NOT NULL,
    event_type      VARCHAR(30) NOT NULL,
    severity        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    occurred_at     DATETIME NOT NULL,
    duration_ms     INT,
    payload         JSON,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    INDEX idx_pe_submission (submission_id),
    INDEX idx_pe_type (event_type),
    INDEX idx_pe_time (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;