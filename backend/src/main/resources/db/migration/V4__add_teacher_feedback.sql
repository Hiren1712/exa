ALTER TABLE submissions
    ADD COLUMN answers JSON NULL,
    ADD COLUMN teacher_feedback TEXT NULL;
