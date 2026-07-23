-- Run this once in your Supabase project's SQL editor (Table Editor > SQL Editor)
-- BEFORE deploying the updated app. Without it, teacher marks-entry
-- assignments made via "Assign Teachers" will not be saved permanently
-- (the app will still run, it just won't remember the assignment after reload).

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS mark_entry_subjects jsonb DEFAULT '[]'::jsonb;
