CREATE TABLE IF NOT EXISTS volunteering_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date date NOT NULL UNIQUE,
  details text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS volunteering_participants (
  service_id uuid NOT NULL REFERENCES volunteering_services(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_volunteering_participants_student ON volunteering_participants(student_id);