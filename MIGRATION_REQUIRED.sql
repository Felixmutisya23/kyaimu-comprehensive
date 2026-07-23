-- Run this ONCE in your Supabase project's SQL editor (Table Editor > SQL Editor)
-- BEFORE deploying the updated app. Safe to run more than once.

-- 1) Marks-entry assignment (separate from teaching assignment) — used by
--    the "Assign Teachers" screen in Exams -> Setup Subjects.
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS mark_entry_subjects jsonb DEFAULT '[]'::jsonb;

-- One-time safety copy: carries every teacher's CURRENT teaching subjects
-- into the new marks-entry column, so nobody loses the ability to enter
-- marks the moment this update goes live. Only fills rows that are still
-- empty.
UPDATE teachers
SET mark_entry_subjects = subjects
WHERE (mark_entry_subjects IS NULL OR mark_entry_subjects = '[]'::jsonb)
  AND subjects IS NOT NULL
  AND subjects <> '[]'::jsonb;

-- 2) Registrar-style permissions — lets a staff member (without being the
--    principal) add/edit students in all classes and message parents.
--    Set on the Teachers screen, under Permissions.
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS can_manage_students boolean DEFAULT false;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS can_message_parents boolean DEFAULT false;
