import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const createStudent = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;

    if (!full_name || String(full_name).trim() === "") {
      return errorResponse(res, "full_name is required", 400);
    }

    const result = await pool.query(
      "INSERT INTO students (full_name, email, phone) VALUES ($1, $2, $3) RETURNING *",
      [full_name.trim(), email || null, phone || null]
    );

    successResponse(res, result.rows[0], "Student created successfully", 201);
  } catch (error) {
    console.error("Create student error:", error);
    errorResponse(res, "Failed to create student", 500);
  }
};

export const getStudents = async (req, res) => {
  try {
    const { active } = req.query;

    const params = [];
    let where = "1=1";

    if (active !== undefined) {
      params.push(active === "true");
      where += ` AND active = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT id, full_name, email, phone, active, created_at
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
      "SELECT id, full_name, email, phone, active, created_at FROM students WHERE id = $1",
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
    const { full_name, email, phone } = req.body;

    const result = await pool.query(
      `UPDATE students
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone)
       WHERE id = $4
       RETURNING id, full_name, email, phone, active, created_at`,
      [full_name, email, phone, id]
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
      "UPDATE students SET active = $1 WHERE id = $2 RETURNING id, full_name, email, phone, active, created_at",
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
