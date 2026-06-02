ALTER TABLE students
  ADD COLUMN IF NOT EXISTS college_name text,
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS semester integer,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS experience numeric;

UPDATE students
SET college_name = COALESCE(college_name, institution_name)
WHERE student_type = 'studying'
  AND college_name IS NULL
  AND institution_name IS NOT NULL;
