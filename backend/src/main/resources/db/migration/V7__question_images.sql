ALTER TABLE questions ADD COLUMN image_url VARCHAR(255) NULL, ADD COLUMN option_images JSON NULL;
CREATE TABLE question_media (
  id VARCHAR(36) PRIMARY KEY,
  owner_id BIGINT UNSIGNED NOT NULL,
  mime_type VARCHAR(30) NOT NULL,
  image_data LONGBLOB NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  INDEX idx_question_media_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
