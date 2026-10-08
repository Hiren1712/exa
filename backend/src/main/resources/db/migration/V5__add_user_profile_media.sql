ALTER TABLE users
    ADD COLUMN cover_image_url VARCHAR(500) NULL;

CREATE TABLE user_profile_media (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    avatar_data LONGBLOB NULL,
    avatar_content_type VARCHAR(100) NULL,
    cover_data LONGBLOB NULL,
    cover_content_type VARCHAR(100) NULL,
    CONSTRAINT fk_user_profile_media_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
