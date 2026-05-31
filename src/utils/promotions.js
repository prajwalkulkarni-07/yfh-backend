const CLASS_ROTATION = [
  "Self Management",
  "Yoga",
  "Relationship",
  "Karma",
  "Diet For Happiness",
  "Habits For Happiness",
  "The Perfect Knowledge",
  "The Real Freedom",
];

export const ensureClasses = async (client) => {
  for (let i = 0; i < CLASS_ROTATION.length; i += 1) {
    await client.query(
      `INSERT INTO classes (name, order_index)
       VALUES ($1, $2)
       ON CONFLICT (name)
       DO UPDATE SET order_index = EXCLUDED.order_index`,
      [CLASS_ROTATION[i], i + 1]
    );
  }
};

export const promoteEligibleStudents = async (client) => {
  await ensureClasses(client);

  await client.query(
    `WITH completed_classes AS (
       SELECT a.student_id
       FROM attendance a
       INNER JOIN class_sessions s ON s.id = a.session_id
       INNER JOIN classes c ON c.id = s.class_id
       WHERE a.status = 'present'
       GROUP BY a.student_id
       HAVING COUNT(DISTINCT c.id) = (SELECT COUNT(*) FROM classes)
     ),
     completed_trip AS (
       SELECT tp.student_id
       FROM trip_participants tp
       INNER JOIN trips t ON t.id = tp.trip_id
       WHERE t.trip_date < CURRENT_DATE
       GROUP BY tp.student_id
     ),
     eligible AS (
       SELECT cc.student_id
       FROM completed_classes cc
       INNER JOIN completed_trip ct ON ct.student_id = cc.student_id
     )
     UPDATE students
     SET level = 2,
         promoted_at = COALESCE(promoted_at, NOW()),
         active = false
     WHERE id IN (SELECT student_id FROM eligible)
       AND level < 2`
  );
};
