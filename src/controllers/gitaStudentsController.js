import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";

const syncPromotedStudents = async (client) => {
  await client.query(
    `INSERT INTO gita_students (student_id)
     SELECT id
     FROM students
     WHERE level >= 2
     ON CONFLICT (student_id)
     DO NOTHING`
  );
};

export const getGitaStudents = async (_req, res) => {
  try {
    await syncPromotedStudents(pool);

    const result = await pool.query(
      `SELECT st.id, st.full_name, st.email, st.phone, st.age, st.student_type,
              st.college_name, st.branch, st.semester, st.company_name, st.designation,
              st.experience, st.active, st.level, st.promoted_at, st.created_at
       FROM gita_students gs
       INNER JOIN students st ON st.id = gs.student_id
       ORDER BY st.full_name ASC`
    );

    successResponse(res, result.rows, "Bhagavad Gita students fetched successfully");
  } catch (error) {
    console.error("Get Bhagavad Gita students error:", error);
    errorResponse(res, "Failed to fetch Bhagavad Gita students", 500);
  }
};

export const getGitaStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    await syncPromotedStudents(pool);

    const result = await pool.query(
      `SELECT st.id, st.full_name, st.email, st.phone, st.age, st.student_type,
              st.college_name, st.branch, st.semester, st.company_name, st.designation,
              st.experience, st.active, st.level, st.promoted_at, st.created_at
       FROM gita_students gs
       INNER JOIN students st ON st.id = gs.student_id
       WHERE st.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, "Student not found", 404);
    }

    successResponse(res, result.rows[0], "Bhagavad Gita student fetched successfully");
  } catch (error) {
    console.error("Get Bhagavad Gita student error:", error);
    errorResponse(res, "Failed to fetch Bhagavad Gita student", 500);
  }
};

export const getGitaStudentAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    await syncPromotedStudents(pool);

    const exists = await pool.query(
      "SELECT 1 FROM gita_students WHERE student_id = $1",
      [id]
    );
    if (exists.rows.length === 0) {
      return errorResponse(res, "Student not found", 404);
    }

    const result = await pool.query(
      `SELECT s.session_date::text as session_date,
              COALESCE(a.status, 'absent') as status,
              a.marked_at::text as marked_at
       FROM gita_sessions s
       LEFT JOIN gita_attendance a
         ON a.session_id = s.id
        AND a.student_id = $1
       ORDER BY s.session_date DESC`,
      [id]
    );

    successResponse(res, result.rows, "Bhagavad Gita attendance fetched successfully");
  } catch (error) {
    console.error("Get Bhagavad Gita student attendance error:", error);
    errorResponse(res, "Failed to fetch Bhagavad Gita attendance", 500);
  }
};
