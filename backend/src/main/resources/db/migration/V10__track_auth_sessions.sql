CREATE TABLE auth_sessions (
    id                  VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id             BIGINT UNSIGNED NOT NULL,
    refresh_token_hash  VARCHAR(64) NOT NULL,
    user_agent          VARCHAR(512) NULL,
    created_at          DATETIME NOT NULL,
    last_seen_at        DATETIME NOT NULL,
    expires_at           DATETIME NOT NULL,
    revoked_at           DATETIME NULL,
    CONSTRAINT uk_auth_sessions_refresh_hash UNIQUE (refresh_token_hash),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_auth_sessions_user_active (user_id, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
