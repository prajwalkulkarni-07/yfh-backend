import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { promoteEligibleStudents } from "../utils/promotions.js";

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

const ensureClasses = async () => {
  for (let i = 0; i < CLASS_ROTATION.length; i += 1) {
    await pool.query(
      `INSERT INTO classes (name, order_index)
       VALUES ($1, $2)
       ON CONFLICT (name)
       DO UPDATE SET order_index = EXCLUDED.order_index`,
      [CLASS_ROTATION[i], i + 1]
    );
  }
};

export const createStudent = async (req, res) => {
  try {
    const {
      full_name,
      phone,
      age,
      student_type,
      institution_name,
      company_name,
    } = req.body;

    if (!full_name || String(full_name).trim() === "") {
      return errorResponse(res, "full_name is required", 400);
    }

    if (!phone || String(phone).trim() === "") {
      return errorResponse(res, "phone is required", 400);
    }

    const parsedAge = Number(age);
    if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
      return errorResponse(res, "age must be a positive number", 400);
    }

    if (!student_type || !["studying", "working"].includes(student_type)) {
      return errorResponse(res, "student_type must be 'studying' or 'working'", 400);
    }

    if (student_type === "studying" && (!institution_name || String(institution_name).trim() === "")) {
      return errorResponse(res, "institution_name is required for studying", 400);
    }

    if (student_type === "working" && (!company_name || String(company_name).trim() === "")) {
      return errorResponse(res, "company_name is required for working", 400);
    }

    const result = await pool.query(
      `INSERT INTO students (full_name, phone, age, student_type, institution_name, company_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        full_name.trim(),
        phone.trim(),
        parsedAge,
        student_type,
        student_type === "studying" ? String(institution_name).trim() : null,
        student_type === "working" ? String(company_name).trim() : null,
      ]
    );

    successResponse(res, result.rows[0], "Student created successfully", 201);
  } catch (error) {
    console.error("Create student error:", error);
    errorResponse(res, "Failed to create student", 500);
  }
};

export const getStudents = async (req, res) => {
  try {
    const { active, include_promoted } = req.query;

    await promoteEligibleStudents(pool);

    const params = [];
    let where = "1=1";

    if (active !== undefined) {
      params.push(active === "true");
      where += ` AND active = $${params.length}`;
    }

    if (include_promoted !== "true") {
      where += " AND level = 1";
    }

    const result = await pool.query(
      `SELECT id, full_name, email, phone, age, student_type, institution_name, company_name,
              active, level, promoted_at, created_at
       FROM students
       WHERE ${where}
       ORDER BY created_at DESC`,
      params
    );

    successResponse(res, result.rows, "Students fetched successfully");
  } catch (error) {
    console.error("Get students error:", error);
    errorResponse(res, "Failed to fetch students", 500);
  }
};

export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, full_name, email, phone, age, student_type, institution_name, company_name,
              active, level, promoted_at, created_at
       FROM students WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, "Student not found", 404);
    }

    successResponse(res, result.rows[0], "Student fetched successfully");
  } catch (error) {
    console.error("Get student by ID error:", error);
    errorResponse(res, "Failed to fetch student", 500);
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      phone,
      age,
      student_type,
      institution_name,
      company_name,
    } = req.body;

    if (phone !== undefined && String(phone).trim() === "") {
      return errorResponse(res, "phone is required", 400);
    }

    const parsedAge = age !== undefined ? Number(age) : undefined;
    if (parsedAge !== undefined) {
      if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
        return errorResponse(res, "age must be a positive number", 400);
      }
    }

    if (student_type !== undefined && !["studying", "working"].includes(student_type)) {
      return errorResponse(res, "student_type must be 'studying' or 'working'", 400);
    }

    if ((institution_name !== undefined || company_name !== undefined) && !student_type) {
      return errorResponse(res, "student_type is required when updating institution or company", 400);
    }

    if (student_type === "studying" && (!institution_name || String(institution_name).trim() === "")) {
      return errorResponse(res, "institution_name is required for studying", 400);
    }

    if (student_type === "working" && (!company_name || String(company_name).trim() === "")) {
      return errorResponse(res, "company_name is required for working", 400);
    }

    const result = await pool.query(
      `UPDATE students
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           age = COALESCE($3, age),
           student_type = COALESCE($4, student_type),
           institution_name = CASE
             WHEN $4 = 'studying' THEN $5
             WHEN $4 = 'working' THEN NULL
             ELSE COALESCE($5, institution_name)
           END,
           company_name = CASE
             WHEN $4 = 'working' THEN $6
             WHEN $4 = 'studying' THEN NULL
             ELSE COALESCE($6, company_name)
           END
       WHERE id = $7
       RETURNING id, full_name, email, phone, age, student_type, institution_name, company_name,
                 active, level, promoted_at, created_at`,
      [full_name, phone, parsedAge, student_type, institution_name, company_name, id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, "Student not found", 404);
    }

    successResponse(res, result.rows[0], "Student updated successfully");
  } catch (error) {
    console.error("Update student error:", error);
    errorResponse(res, "Failed to update student", 500);
  }
};

export const setStudentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (active === undefined) {
      return errorResponse(res, "active is required", 400);
    }

    const result = await pool.query(
      `UPDATE students SET active = $1 WHERE id = $2
       RETURNING id, full_name, email, phone, age, student_type, institution_name, company_name,
                 active, level, promoted_at, created_at`,
      [Boolean(active), id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, "Student not found", 404);
    }

    successResponse(res, result.rows[0], "Student status updated successfully");
  } catch (error) {
    console.error("Update student status error:", error);
    errorResponse(res, "Failed to update student status", 500);
  }
};

export const deleteStudent = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const attendanceResult = await client.query(
      "DELETE FROM attendance WHERE student_id = $1",
      [id]
    );

    const studentResult = await client.query(
      "DELETE FROM students WHERE id = $1 RETURNING id",
      [id]
    );

    if (studentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Student not found", 404);
    }

    await client.query("COMMIT");
    successResponse(
      res,
      { id, attendance_removed: attendanceResult.rowCount },
      "Student deleted successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete student error:", error);
    errorResponse(res, "Failed to delete student", 500);
  } finally {
    client.release();
  }
};

export const getStudentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const studentResult = await pool.query(
      `SELECT id, full_name, email, phone, age, student_type, institution_name, company_name,
              active, level, promoted_at, created_at
       FROM students WHERE id = $1`,
      [id]
    );

    if (studentResult.rows.length === 0) {
      return errorResponse(res, "Student not found", 404);
    }

    await ensureClasses();
    const sessionsResult = await pool.query(
      `SELECT c.id as class_id,
              c.name as class_name,
              c.order_index,
              CASE WHEN MAX(a.marked_at) IS NULL THEN 'absent' ELSE 'present' END as status,
              MAX(a.marked_at)::date as attended_on
       FROM classes c
       LEFT JOIN class_sessions s ON s.class_id = c.id
       LEFT JOIN attendance a
         ON a.session_id = s.id
        AND a.student_id = $1
        AND a.status = 'present'
       GROUP BY c.id, c.name, c.order_index
       ORDER BY c.order_index ASC`,
      [id]
    );

    const tripResult = await pool.query(
      `SELECT MAX(t.trip_date) as last_trip_date,
              COUNT(*) FILTER (WHERE t.trip_date < CURRENT_DATE) > 0 as has_attended_trip
       FROM trip_participants tp
       INNER JOIN trips t ON t.id = tp.trip_id
       WHERE tp.student_id = $1`,
      [id]
    );

    const tripInfo = tripResult.rows[0] ?? { last_trip_date: null, has_attended_trip: false };

    successResponse(res, {
      student: studentResult.rows[0],
      sessions: sessionsResult.rows,
      trip_info: {
        last_trip_date: tripInfo.last_trip_date,
        has_attended_trip: Boolean(tripInfo.has_attended_trip),
      },
    }, "Student details fetched successfully");
  } catch (error) {
    console.error("Get student details error:", error);
    errorResponse(res, "Failed to fetch student details", 500);
  }
};
