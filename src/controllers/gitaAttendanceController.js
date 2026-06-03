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

const getDayOfWeek = (sessionDate) => {
  const date = new Date(`${sessionDate}T00:00:00Z`);
  return dayNames[date.getUTCDay()];
};

const ensureSunday = (sessionDate) => {
  const date = new Date(`${sessionDate}T00:00:00Z`);
  return date.getUTCDay() === 0;
};

const ensureStudentsAreGita = async (client, studentIds) => {
  if (!studentIds.length) return true;
  const result = await client.query(
    "SELECT student_id FROM gita_students WHERE student_id = ANY($1::uuid[])",
    [studentIds]
  );
  return result.rows.length === studentIds.length;
};

export const createSession = async (req, res) => {
  try {
    const { session_date } = req.body;

    if (!session_date) {
      return errorResponse(res, "session_date is required", 400);
    }

    if (!ensureSunday(session_date)) {
      return errorResponse(res, "Bhagavad Gita classes are only on Sundays", 400);
    }

    const dayOfWeek = getDayOfWeek(session_date);

    const result = await pool.query(
      `INSERT INTO gita_sessions (session_date, day_of_week, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_date)
       DO UPDATE SET day_of_week = EXCLUDED.day_of_week
       RETURNING *`,
      [session_date, dayOfWeek, req.user.id]
    );

    successResponse(res, result.rows[0], "Bhagavad Gita session created successfully", 201);
  } catch (error) {
    console.error("Create Bhagavad Gita session error:", error);
    errorResponse(res, "Failed to create Bhagavad Gita session", 500);
  }
};

export const getSessions = async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let where = "1=1";

    if (from) {
      params.push(from);
      where += ` AND session_date >= $${params.length}`;
    }

    if (to) {
      params.push(to);
      where += ` AND session_date <= $${params.length}`;
    }

    const result = await pool.query(
      `SELECT id, session_date::text as session_date, day_of_week, created_by, created_at
       FROM gita_sessions
       WHERE ${where}
       ORDER BY session_date DESC`,
      params
    );

    successResponse(res, result.rows, "Bhagavad Gita sessions fetched successfully");
  } catch (error) {
    console.error("Get Bhagavad Gita sessions error:", error);
    errorResponse(res, "Failed to fetch Bhagavad Gita sessions", 500);
  }
};

export const markAttendance = async (req, res) => {
  const client = await pool.connect();
  try {
    const { session_date, records } = req.body;

    if (!session_date || !Array.isArray(records) || records.length === 0) {
      return errorResponse(res, "session_date and records are required", 400);
    }

    if (!ensureSunday(session_date)) {
      return errorResponse(res, "Bhagavad Gita classes are only on Sundays", 400);
    }

    await client.query("BEGIN");

    const dayOfWeek = getDayOfWeek(session_date);
    const sessionResult = await client.query(
      `INSERT INTO gita_sessions (session_date, day_of_week, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_date)
       DO UPDATE SET day_of_week = EXCLUDED.day_of_week
       RETURNING id`,
      [session_date, dayOfWeek, req.user.id]
    );

    const sessionId = sessionResult.rows[0].id;

    const studentIds = records.map((record) => record.student_id);
    const isValid = await ensureStudentsAreGita(client, studentIds);
    if (!isValid) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Only promoted students can be marked in Bhagavad Gita attendance", 400);
    }

    const inserted = [];

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
        `INSERT INTO gita_attendance (session_id, student_id, status, marked_by, marked_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (session_id, student_id)
         DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = NOW()
         RETURNING *`,
        [sessionId, student_id, status, req.user.id]
      );

      inserted.push(result.rows[0]);
    }

    await client.query("COMMIT");

    successResponse(res, {
      session_id: sessionId,
      updated_count: inserted.length,
      records: inserted,
    }, "Bhagavad Gita attendance marked successfully", 201);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Mark Bhagavad Gita attendance error:", error);
    errorResponse(res, "Failed to mark Bhagavad Gita attendance", 500);
  } finally {
    client.release();
  }
};

export const getAttendance = async (req, res) => {
  try {
    const { session_date, session_id } = req.query;

    const params = [];
    let where = "1=1";

    if (session_id) {
      params.push(session_id);
      where += ` AND a.session_id = $${params.length}`;
    }

    if (session_date) {
      params.push(session_date);
      where += ` AND s.session_date = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT a.id, a.status, a.marked_at,
              s.id as session_id, s.session_date::text as session_date, s.day_of_week,
              st.id as student_id, st.full_name as student_name,
              u.name as marked_by_name
       FROM gita_attendance a
       INNER JOIN gita_sessions s ON s.id = a.session_id
       INNER JOIN students st ON st.id = a.student_id
       LEFT JOIN users u ON u.id = a.marked_by
       WHERE ${where}
       ORDER BY s.session_date DESC, st.full_name ASC`,
      params
    );

    successResponse(res, result.rows, "Bhagavad Gita attendance fetched successfully");
  } catch (error) {
    console.error("Get Bhagavad Gita attendance error:", error);
    errorResponse(res, "Failed to fetch Bhagavad Gita attendance", 500);
  }
};
