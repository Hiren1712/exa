CREATE TABLE exabot_chat_limits (
    user_id         BIGINT UNSIGNED PRIMARY KEY,
    banned_until    DATETIME(6) NULL,
    cooldown_until  DATETIME(6) NULL,
    warning_count   INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_exabot_chat_limits_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
