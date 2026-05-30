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

const getDayOfWeek = (classDate) => {
  const date = new Date(`${classDate}T00:00:00Z`);
  return dayNames[date.getUTCDay()];
};

export const createSession = async (req, res) => {
  try {
    const { class_date } = req.body;

    if (!class_date) {
      return errorResponse(res, "class_date is required", 400);
    }

    const dayOfWeek = getDayOfWeek(class_date);

    const result = await pool.query(
      `INSERT INTO class_sessions (class_date, day_of_week, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_date)
       DO UPDATE SET day_of_week = EXCLUDED.day_of_week
       RETURNING *`,
      [class_date, dayOfWeek, req.user.id]
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
      `SELECT id, class_date, day_of_week, created_by, created_at
       FROM class_sessions
       WHERE ${where}
       ORDER BY class_date DESC`,
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
    const sessionResult = await client.query(
      `INSERT INTO class_sessions (class_date, day_of_week, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_date)
       DO UPDATE SET day_of_week = EXCLUDED.day_of_week
       RETURNING id`,
      [class_date, dayOfWeek, req.user.id]
    );

    const sessionId = sessionResult.rows[0].id;
    const inserted = [];
    const studentIds = [];

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
    }

    if (studentIds.length > 0) {
      await client.query(
        `WITH recent AS (
           SELECT a.student_id, a.status,
                  ROW_NUMBER() OVER (
                    PARTITION BY a.student_id
                    ORDER BY s.class_date DESC
                  ) AS rn
           FROM attendance a
           INNER JOIN class_sessions s ON s.id = a.session_id
           WHERE a.student_id = ANY($1::uuid[])
         ),
         to_deactivate AS (
           SELECT student_id
           FROM recent
           WHERE rn <= 2
           GROUP BY student_id
           HAVING COUNT(*) = 2 AND BOOL_AND(status = 'absent')
         )
         UPDATE students
         SET active = false
         WHERE id IN (SELECT student_id FROM to_deactivate)
           AND active = true`,
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
              s.id as session_id, s.class_date, s.day_of_week,
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
