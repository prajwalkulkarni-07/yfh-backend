import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, "Email and password are required", 400);
    }

    const result = await pool.query(
      "SELECT id, name, email, password, role, must_change_password FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, "Invalid email or password", 401);
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return errorResponse(res, "Invalid email or password", 401);
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    delete user.password;

    successResponse(res, { user, token }, "Login successful");
  } catch (error) {
    console.error("Login error:", error);
    errorResponse(res, "Failed to login", 500);
  }
};

export const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, must_change_password, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, "User not found", 404);
    }

    successResponse(res, result.rows[0], "Profile fetched successfully");
  } catch (error) {
    console.error("Get profile error:", error);
    errorResponse(res, "Failed to fetch profile", 500);
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return errorResponse(res, "New password is required", 400);
    }

    const userResult = await pool.query(
      "SELECT password, must_change_password FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return errorResponse(res, "User not found", 404);
    }

    const user = userResult.rows[0];

    if (!user.must_change_password) {
      if (!currentPassword) {
        return errorResponse(res, "Current password is required", 400);
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);

      if (!isValid) {
        return errorResponse(res, "Current password is incorrect", 401);
      }
    }

    const sameAsOld = await bcrypt.compare(newPassword, user.password);
    if (sameAsOld) {
      return errorResponse(res, "New password cannot be the same as current password", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET password = $1, must_change_password = false WHERE id = $2",
      [hashedPassword, req.user.id]
    );

    successResponse(res, null, "Password changed successfully");
  } catch (error) {
    console.error("Change password error:", error);
    errorResponse(res, "Failed to change password", 500);
  }
};
