SET @answers_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'submissions'
      AND column_name = 'answers'
);
SET @answers_migration = IF(
    @answers_column_exists = 0,
    'ALTER TABLE submissions ADD COLUMN answers JSON NULL',
    'SELECT 1'
);
PREPARE answers_statement FROM @answers_migration;
EXECUTE answers_statement;
DEALLOCATE PREPARE answers_statement;

SET @feedback_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'submissions'
      AND column_name = 'teacher_feedback'
);
SET @feedback_migration = IF(
    @feedback_column_exists = 0,
    'ALTER TABLE submissions ADD COLUMN teacher_feedback TEXT NULL',
    'SELECT 1'
);
PREPARE feedback_statement FROM @feedback_migration;
EXECUTE feedback_statement;
DEALLOCATE PREPARE feedback_statement;
