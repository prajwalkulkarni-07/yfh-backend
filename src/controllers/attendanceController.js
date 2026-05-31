import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const CLASS_ROTATION_START = "2026-05-31";
const CLASS_ROTATION_START_INDEX = 6;
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
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getDayOfWeek = (classDate) => {
  const date = new Date(`${classDate}T00:00:00Z`);
  return dayNames[date.getUTCDay()];
};

const parseDate = (value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getClassNameForDate = (classDate) => {
  const date = parseDate(classDate);
  if (!date || date.getUTCDay() !== 0) return null;
  const start = parseDate(CLASS_ROTATION_START);
  if (!start) return null;
  const diffDays = Math.floor((date - start) / MS_PER_DAY);
  if (diffDays % 7 !== 0) return null;
  const weeksOffset = diffDays / 7;
  const index =
    ((weeksOffset + CLASS_ROTATION_START_INDEX) % CLASS_ROTATION.length +
      CLASS_ROTATION.length) %
    CLASS_ROTATION.length;
  return CLASS_ROTATION[index];
};

const ensureClasses = async (client) => {
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

const getClassIdForDate = async (client, classDate) => {
  const className = getClassNameForDate(classDate);
  if (!className) return null;
  await ensureClasses(client);
  const result = await client.query(
    "SELECT id FROM classes WHERE name = $1",
    [className]
  );
  return result.rows[0]?.id ?? null;
};

export const createSession = async (req, res) => {
  try {
    const { class_date } = req.body;

    if (!class_date) {
      return errorResponse(res, "class_date is required", 400);
    }

    const dayOfWeek = getDayOfWeek(class_date);
    const classId = await getClassIdForDate(pool, class_date);

    const result = await pool.query(
      `INSERT INTO class_sessions (class_date, day_of_week, class_id, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (class_date)
       DO UPDATE SET day_of_week = EXCLUDED.day_of_week,
                     class_id = EXCLUDED.class_id
       RETURNING *`,
      [class_date, dayOfWeek, classId, req.user.id]
    );

    successResponse(res, result.rows[0], "Session created successfully", 201);
  } catch (error) {
    console.error("Create session error:", error);
    errorResponse(res, "Failed to create session", 500);
  }
};

export const getSessions = async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let where = "1=1";

    if (from) {
      params.push(from);
      where += ` AND class_date >= $${params.length}`;
    }

    if (to) {
      params.push(to);
      where += ` AND class_date <= $${params.length}`;
    }

    const result = await pool.query(
      `SELECT s.id, s.class_date::text as class_date, s.day_of_week, s.created_by, s.created_at,
              c.id as class_id, c.name as class_name
       FROM class_sessions s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE ${where}
       ORDER BY s.class_date DESC`,
      params
    );

    successResponse(res, result.rows, "Sessions fetched successfully");
  } catch (error) {
    console.error("Get sessions error:", error);
    errorResponse(res, "Failed to fetch sessions", 500);
  }
};

export const markAttendance = async (req, res) => {
  const client = await pool.connect();
  try {
    const { class_date, records } = req.body;

    if (!class_date || !Array.isArray(records) || records.length === 0) {
      return errorResponse(res, "class_date and records are required", 400);
    }

    await client.query("BEGIN");

    const dayOfWeek = getDayOfWeek(class_date);
    const classId = await getClassIdForDate(client, class_date);
    const sessionResult = await client.query(
      `INSERT INTO class_sessions (class_date, day_of_week, class_id, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (class_date)
       DO UPDATE SET day_of_week = EXCLUDED.day_of_week,
                     class_id = EXCLUDED.class_id
       RETURNING id`,
      [class_date, dayOfWeek, classId, req.user.id]
    );

    const sessionId = sessionResult.rows[0].id;
    const inserted = [];
    const studentIds = [];
    const presentStudentIds = [];

    for (const record of records) {
      const { student_id, status } = record;

      if (!student_id || !status) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Each record must include student_id and status", 400);
      }

      if (!["present", "absent"].includes(status)) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Status must be 'present' or 'absent'", 400);
      }

      const result = await client.query(
        `INSERT INTO attendance (session_id, student_id, status, marked_by, marked_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (session_id, student_id)
         DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = NOW()
         RETURNING *`,
        [sessionId, student_id, status, req.user.id]
      );

      inserted.push(result.rows[0]);
      studentIds.push(student_id);
      if (status === "present") {
        presentStudentIds.push(student_id);
      }
    }

    if (presentStudentIds.length > 0) {
      await client.query(
        `UPDATE students
         SET active = true
         WHERE id = ANY($1::uuid[])
           AND active = false
           AND level = 1`,
        [presentStudentIds]
      );
    }

    if (studentIds.length > 0) {
      await client.query(
        `WITH attended AS (
           SELECT a.student_id, c.order_index
           FROM attendance a
           INNER JOIN class_sessions s ON s.id = a.session_id
           INNER JOIN classes c ON c.id = s.class_id
           WHERE a.status = 'present'
             AND a.student_id = ANY($1::uuid[])
           GROUP BY a.student_id, c.order_index
         ),
         all_classes AS (
           SELECT order_index
           FROM classes
         ),
         missing AS (
           SELECT st.id as student_id, ac.order_index
           FROM students st
           CROSS JOIN all_classes ac
           LEFT JOIN attended a
             ON a.student_id = st.id
            AND a.order_index = ac.order_index
           WHERE st.id = ANY($1::uuid[])
             AND st.level = 1
             AND a.order_index IS NULL
         ),
         next_required AS (
           SELECT student_id, MIN(order_index) as order_index
           FROM missing
           GROUP BY student_id
         ),
         completed AS (
           SELECT st.id as student_id
           FROM students st
           LEFT JOIN attended a ON a.student_id = st.id
           WHERE st.id = ANY($1::uuid[])
             AND st.level = 1
           GROUP BY st.id
           HAVING COUNT(a.order_index) = (SELECT COUNT(*) FROM classes)
         ),
         target AS (
           SELECT nr.student_id, nr.order_index
           FROM next_required nr
           LEFT JOIN completed c ON c.student_id = nr.student_id
           WHERE c.student_id IS NULL
         ),
         last_two_sessions AS (
           SELECT t.student_id, s.id as session_id,
                  ROW_NUMBER() OVER (
                    PARTITION BY t.student_id
                    ORDER BY s.class_date DESC
                  ) AS rn
           FROM target t
           INNER JOIN classes c ON c.order_index = t.order_index
           INNER JOIN class_sessions s ON s.class_id = c.id
         ),
         eligible AS (
           SELECT lts.student_id
           FROM last_two_sessions lts
           LEFT JOIN attendance a
             ON a.session_id = lts.session_id
            AND a.student_id = lts.student_id
            AND a.status = 'present'
           WHERE lts.rn <= 2
           GROUP BY lts.student_id
           HAVING COUNT(*) = 2 AND COUNT(a.session_id) = 0
         )
         UPDATE students
         SET active = false
         WHERE id IN (SELECT student_id FROM eligible)
           AND active = true
           AND level = 1`,
        [studentIds]
      );
    }

    await client.query("COMMIT");

    successResponse(res, {
      session_id: sessionId,
      updated_count: inserted.length,
      records: inserted,
    }, "Attendance marked successfully", 201);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Mark attendance error:", error);
    errorResponse(res, "Failed to mark attendance", 500);
  } finally {
    client.release();
  }
};

export const getAttendance = async (req, res) => {
  try {
    const { session_id, class_date } = req.query;

    const params = [];
    let where = "1=1";

    if (session_id) {
      params.push(session_id);
      where += ` AND a.session_id = $${params.length}`;
    }

    if (class_date) {
      params.push(class_date);
      where += ` AND s.class_date = $${params.length}`;
    }

    const result = await pool.query(
          `SELECT a.id, a.status, a.marked_at,
            s.id as session_id, s.class_date::text as class_date, s.day_of_week,
              st.id as student_id, st.full_name as student_name,
              u.name as marked_by_name
       FROM attendance a
       INNER JOIN class_sessions s ON s.id = a.session_id
       INNER JOIN students st ON st.id = a.student_id
       LEFT JOIN users u ON u.id = a.marked_by
       WHERE ${where}
       ORDER BY s.class_date DESC, st.full_name ASC`,
      params
    );

    successResponse(res, result.rows, "Attendance fetched successfully");
  } catch (error) {
    console.error("Get attendance error:", error);
    errorResponse(res, "Failed to fetch attendance", 500);
  }
};

export const getSummary = async (req, res) => {
  try {
    const { from, to } = req.query;

    const params = [];
    let sessionWhere = "1=1";

    if (from) {
      params.push(from);
      sessionWhere += ` AND class_date >= $${params.length}`;
    }

    if (to) {
      params.push(to);
      sessionWhere += ` AND class_date <= $${params.length}`;
    }

    const result = await pool.query(
      `WITH filtered_sessions AS (
         SELECT id
         FROM class_sessions
         WHERE ${sessionWhere}
       )
       SELECT st.id as student_id,
              st.full_name as student_name,
              COUNT(a.id) as total_sessions,
              SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
              SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
              CASE WHEN COUNT(a.id) > 0
                THEN ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::numeric / COUNT(a.id)::numeric) * 100, 2)
                ELSE 0
              END as attendance_percentage
       FROM students st
       LEFT JOIN attendance a
         ON st.id = a.student_id
        AND a.session_id IN (SELECT id FROM filtered_sessions)
       WHERE st.level = 1
       GROUP BY st.id, st.full_name
       ORDER BY st.full_name ASC`,
      params
    );

    successResponse(res, result.rows, "Attendance summary fetched successfully");
  } catch (error) {
    console.error("Get summary error:", error);
    errorResponse(res, "Failed to fetch attendance summary", 500);
  }
};
