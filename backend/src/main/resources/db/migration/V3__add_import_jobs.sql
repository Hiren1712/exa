-- ============================================================
-- EXA Platform — Schema v3
-- Thêm bảng cho module Import AI
-- ============================================================

CREATE TABLE import_jobs (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    original_name   VARCHAR(255) NOT NULL,
    storage_path    VARCHAR(500) NOT NULL,
    file_type       VARCHAR(20) NOT NULL,
    file_size       BIGINT,
    status          ENUM('UPLOADED','EXTRACTING','PARSING','REVIEW','IMPORTED','FAILED')
                    NOT NULL DEFAULT 'UPLOADED',
    extracted_text  MEDIUMTEXT,
    parsed_result   JSON,
    total_found     INT NOT NULL DEFAULT 0,
    total_imported  INT NOT NULL DEFAULT 0,
    error_message   TEXT,
    ai_model        VARCHAR(60),
    ai_tokens_used  INT,
    started_at      DATETIME,
    finished_at     DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_import_user (user_id),
    INDEX idx_import_status (status),
    INDEX idx_import_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm cột liên kết câu hỏi với import job
ALTER TABLE questions
    ADD COLUMN import_job_id BIGINT UNSIGNED NULL,
    ADD COLUMN import_reviewed BOOLEAN NOT NULL DEFAULT TRUE,
    ADD CONSTRAINT fk_question_import
        FOREIGN KEY (import_job_id) REFERENCES import_jobs(id);