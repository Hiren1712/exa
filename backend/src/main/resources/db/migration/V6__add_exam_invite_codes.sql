ALTER TABLE exams
    ADD COLUMN invite_code VARCHAR(12) NULL,
    ADD UNIQUE INDEX uk_exam_invite_code (invite_code);
