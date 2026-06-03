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
      college_name,
      branch,
      semester,
      company_name,
      designation,
      experience,
    } = req.body;

    if (!full_name || String(full_name).trim() === "") {
      return errorResponse(res, "full_name is required", 400);
    }

    if (!phone || String(phone).trim() === "") {
      return errorResponse(res, "phone is required", 400);
    }

    const phoneValue = String(phone).trim();
    const existing = await pool.query(
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

    if (!student_type || !["studying", "working"].includes(student_type)) {
      return errorResponse(res, "student_type must be 'studying' or 'working'", 400);
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

    const result = await pool.query(
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
         experience
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        full_name.trim(),
        phoneValue,
        parsedAge,
        student_type,
        student_type === "studying" ? String(college_name).trim() : null,
        student_type === "studying" ? String(branch).trim() : null,
        student_type === "studying" ? parsedSemester : null,
        student_type === "working" ? String(company_name).trim() : null,
        student_type === "working" ? String(designation).trim() : null,
        student_type === "working" ? parsedExperience : null,
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
          `SELECT id, full_name, email, phone, age, student_type, college_name, branch, semester,
            company_name, designation, experience,
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
          `SELECT id, full_name, email, phone, age, student_type, college_name, branch, semester,
            company_name, designation, experience,
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
      college_name,
      branch,
      semester,
      company_name,
      designation,
      experience,
    } = req.body;

    if (phone !== undefined && String(phone).trim() === "") {
      return errorResponse(res, "phone is required", 400);
    }

    if (phone !== undefined) {
      const phoneValue = String(phone).trim();
      const existing = await pool.query(
        "SELECT 1 FROM students WHERE phone = $1 AND id <> $2 LIMIT 1",
        [phoneValue, id]
      );
      if (existing.rows.length > 0) {
        return errorResponse(res, "Student with this phone number already exists", 409);
      }
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

    const parsedSemester = semester !== undefined ? Number(semester) : undefined;
    const parsedExperience = experience !== undefined ? Number(experience) : undefined;

    if ((college_name !== undefined || branch !== undefined || semester !== undefined || company_name !== undefined || designation !== undefined || experience !== undefined) && !student_type) {
      return errorResponse(res, "student_type is required when updating profile details", 400);
    }

    if (student_type === "studying") {
      if (college_name !== undefined && String(college_name).trim() === "") {
        return errorResponse(res, "college_name is required for studying", 400);
      }
      if (branch !== undefined && String(branch).trim() === "") {
        return errorResponse(res, "branch is required for studying", 400);
      }
      if (semester !== undefined && (!Number.isFinite(parsedSemester) || parsedSemester <= 0)) {
        return errorResponse(res, "semester must be a positive number", 400);
      }
    }

    if (student_type === "working") {
      if (company_name !== undefined && String(company_name).trim() === "") {
        return errorResponse(res, "company_name is required for working", 400);
      }
      if (designation !== undefined && String(designation).trim() === "") {
        return errorResponse(res, "designation is required for working", 400);
      }
      if (experience !== undefined && (!Number.isFinite(parsedExperience) || parsedExperience < 0)) {
        return errorResponse(res, "experience must be a non-negative number", 400);
      }
    }

    const result = await pool.query(
      `UPDATE students
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           age = COALESCE($3, age),
           student_type = COALESCE($4, student_type),
           college_name = CASE
             WHEN $4 = 'studying' THEN $5
             WHEN $4 = 'working' THEN NULL
             ELSE COALESCE($5, college_name)
           END,
           branch = CASE
             WHEN $4 = 'studying' THEN $6
             WHEN $4 = 'working' THEN NULL
             ELSE COALESCE($6, branch)
           END,
           semester = CASE
             WHEN $4 = 'studying' THEN $7
             WHEN $4 = 'working' THEN NULL
             ELSE COALESCE($7, semester)
           END,
           company_name = CASE
             WHEN $4 = 'working' THEN $8
             WHEN $4 = 'studying' THEN NULL
             ELSE COALESCE($8, company_name)
           END,
           designation = CASE
             WHEN $4 = 'working' THEN $9
             WHEN $4 = 'studying' THEN NULL
             ELSE COALESCE($9, designation)
           END,
           experience = CASE
             WHEN $4 = 'working' THEN $10
             WHEN $4 = 'studying' THEN NULL
             ELSE COALESCE($10, experience)
           END
       WHERE id = $11
       RETURNING id, full_name, email, phone, age, student_type, college_name, branch, semester,
                 company_name, designation, experience,
                 active, level, promoted_at, created_at`,
      [
        full_name,
        phone,
        parsedAge,
        student_type,
        college_name,
        branch,
        parsedSemester,
        company_name,
        designation,
        parsedExperience,
        id,
      ]
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
       RETURNING id, full_name, email, phone, age, student_type, college_name, branch, semester,
                 company_name, designation, experience,
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
          `SELECT id, full_name, email, phone, age, student_type, college_name, branch, semester,
            company_name, designation, experience,
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
              CASE WHEN COUNT(a.id) = 0 THEN 'absent' ELSE 'present' END as status,
              MAX(s.class_date)::text as attended_on
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

    const tripHistoryResult = await pool.query(
      `SELECT t.trip_date::text as trip_date,
              t.details,
              tp.added_at::text as recorded_at
       FROM trip_participants tp
       INNER JOIN trips t ON t.id = tp.trip_id
       WHERE tp.student_id = $1
       ORDER BY t.trip_date DESC, tp.added_at DESC`,
      [id]
    );

    const volunteeringHistoryResult = await pool.query(
      `SELECT vs.service_date::text as service_date,
              vs.details,
              vp.added_at::text as recorded_at
       FROM volunteering_participants vp
       INNER JOIN volunteering_services vs ON vs.id = vp.service_id
       WHERE vp.student_id = $1
       ORDER BY vs.service_date DESC, vp.added_at DESC`,
      [id]
    );

    const promotionResult = await pool.query(
      `WITH class_count AS (
         SELECT COUNT(DISTINCT c.id) as attended_classes
         FROM attendance a
         INNER JOIN class_sessions s ON s.id = a.session_id
         INNER JOIN classes c ON c.id = s.class_id
         WHERE a.student_id = $1
           AND a.status = 'present'
       ),
       trip_count AS (
         SELECT COUNT(DISTINCT tp.trip_id) as trip_count
         FROM trip_participants tp
         WHERE tp.student_id = $1
       ),
       volunteering_count AS (
         SELECT COUNT(DISTINCT vp.service_id) as volunteering_count
         FROM volunteering_participants vp
         WHERE vp.student_id = $1
       )
       SELECT cc.attended_classes,
              tc.trip_count,
              vc.volunteering_count,
              (SELECT COUNT(*) FROM classes) as total_classes
       FROM class_count cc, trip_count tc, volunteering_count vc`,
      [id]
    );

    const promotionInfo = promotionResult.rows[0] ?? {
      attended_classes: 0,
      trip_count: 0,
      volunteering_count: 0,
      total_classes: 8,
    };

    const attendedClasses = Number(promotionInfo.attended_classes ?? 0);
    const tripCount = Number(promotionInfo.trip_count ?? 0);
    const volunteeringCount = Number(promotionInfo.volunteering_count ?? 0);
    const totalClasses = Number(promotionInfo.total_classes ?? 8);
    const missingClasses = Math.max(totalClasses - attendedClasses, 0);
    const missingParts = [];

    if (missingClasses > 0) {
      missingParts.push(`Needs to attend ${missingClasses} more class${missingClasses === 1 ? "" : "es"}`);
    }
    if (tripCount === 0) {
      missingParts.push("Needs to attend one trip");
    }
    if (volunteeringCount === 0) {
      missingParts.push("Needs to volunteer once");
    }

    const promoted = Number(studentResult.rows[0].level ?? 1) >= 2;
    const promotionStatus = {
      promoted,
      attended_classes: attendedClasses,
      total_classes: totalClasses,
      attended_trips: tripCount,
      volunteered_times: volunteeringCount,
      missing: missingParts,
      summary: promoted
        ? "Promoted"
        : missingParts.length > 0
          ? missingParts.join(", ")
          : "Eligible for promotion",
    };

    successResponse(res, {
      student: studentResult.rows[0],
      sessions: sessionsResult.rows,
      trips: tripHistoryResult.rows,
      volunteering: volunteeringHistoryResult.rows,
      promotion_status: promotionStatus,
    }, "Student details fetched successfully");
  } catch (error) {
    console.error("Get student details error:", error);
    errorResponse(res, "Failed to fetch student details", 500);
  }
};
