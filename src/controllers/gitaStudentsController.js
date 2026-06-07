import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";

const STUDENT_TYPES = ["studying", "working", "not_studying_not_working"];

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

export const createGitaStudent = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      full_name,
      phone,
      age,
      student_type,
      college_name,
      branch,
      semester,
      company_name,
      designation,
      experience,
      description,
    } = req.body;

    if (!full_name || String(full_name).trim() === "") {
      return errorResponse(res, "full_name is required", 400);
    }
    if (!phone || String(phone).trim() === "") {
      return errorResponse(res, "phone is required", 400);
    }

    const phoneValue = String(phone).trim();
    const existing = await client.query(
      "SELECT 1 FROM students WHERE phone = $1 LIMIT 1",
      [phoneValue]
    );
    if (existing.rows.length > 0) {
      return errorResponse(res, "Student with this phone number already exists", 409);
    }

    const parsedAge = Number(age);
    if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
      return errorResponse(res, "age must be a positive number", 400);
    }

    if (!student_type || !STUDENT_TYPES.includes(student_type)) {
      return errorResponse(res, "student_type must be 'studying', 'working', or 'not_studying_not_working'", 400);
    }

    const parsedSemester = semester !== undefined ? Number(semester) : undefined;
    const parsedExperience = experience !== undefined ? Number(experience) : undefined;

    if (student_type === "studying") {
      if (!college_name || String(college_name).trim() === "") {
        return errorResponse(res, "college_name is required for studying", 400);
      }
      if (!branch || String(branch).trim() === "") {
        return errorResponse(res, "branch is required for studying", 400);
      }
      if (!Number.isFinite(parsedSemester) || parsedSemester <= 0) {
        return errorResponse(res, "semester must be a positive number", 400);
      }
    }

    if (student_type === "working") {
      if (!company_name || String(company_name).trim() === "") {
        return errorResponse(res, "company_name is required for working", 400);
      }
      if (!designation || String(designation).trim() === "") {
        return errorResponse(res, "designation is required for working", 400);
      }
      if (!Number.isFinite(parsedExperience) || parsedExperience < 0) {
        return errorResponse(res, "experience must be a non-negative number", 400);
      }
    }

    if (student_type === "not_studying_not_working" && (!description || String(description).trim() === "")) {
      return errorResponse(res, "description is required for preparing for govt exams", 400);
    }

    await client.query("BEGIN");

    const studentResult = await client.query(
      `INSERT INTO students (
         full_name,
         phone,
         age,
         student_type,
         college_name,
         branch,
         semester,
         company_name,
         designation,
         experience,
         description,
         level,
         promoted_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 2, NOW())
       RETURNING *`,
      [
        String(full_name).trim(),
        phoneValue,
        parsedAge,
        student_type,
        student_type === "studying" ? String(college_name).trim() : null,
        student_type === "studying" ? String(branch).trim() : null,
        student_type === "studying" ? parsedSemester : null,
        student_type === "working" ? String(company_name).trim() : null,
        student_type === "working" ? String(designation).trim() : null,
        student_type === "working" ? parsedExperience : null,
        student_type === "not_studying_not_working" ? String(description).trim() : null,
      ]
    );

    await client.query(
      `INSERT INTO gita_students (student_id)
       VALUES ($1)
       ON CONFLICT (student_id)
       DO NOTHING`,
      [studentResult.rows[0].id]
    );

    await client.query("COMMIT");
    successResponse(res, studentResult.rows[0], "Bhagavad Gita student created successfully", 201);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Bhagavad Gita student error:", error);
    errorResponse(res, "Failed to create Bhagavad Gita student", 500);
  } finally {
    client.release();
  }
};

export const getGitaStudents = async (_req, res) => {
  try {
    await syncPromotedStudents(pool);

    const result = await pool.query(
      `SELECT st.id, st.full_name, st.email, st.phone, st.age, st.student_type,
              st.college_name, st.branch, st.semester, st.company_name, st.designation,
              st.experience, st.description, st.active, st.level, st.promoted_at, st.created_at
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
              st.experience, st.description, st.active, st.level, st.promoted_at, st.created_at
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
