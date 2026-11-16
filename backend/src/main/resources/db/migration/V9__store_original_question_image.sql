ALTER TABLE question_media
    ADD COLUMN original_mime_type VARCHAR(30) NULL,
    ADD COLUMN original_image_data LONGBLOB NULL;
