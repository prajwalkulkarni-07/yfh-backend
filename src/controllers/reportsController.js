import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const getInactiveReport = async (_req, res) => {
  try {
    const result = await pool.query(
      `WITH last_attendance AS (
         SELECT a.student_id,
                s.class_date,
                c.name as class_name,
                ROW_NUMBER() OVER (
                  PARTITION BY a.student_id
                  ORDER BY s.class_date DESC, a.marked_at DESC
                ) AS rn
         FROM attendance a
         INNER JOIN class_sessions s ON s.id = a.session_id
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE a.status = 'present'
       ),
       completed AS (
         SELECT a.student_id
         FROM attendance a
         INNER JOIN class_sessions s ON s.id = a.session_id
         INNER JOIN classes c ON c.id = s.class_id
         WHERE a.status = 'present'
         GROUP BY a.student_id
         HAVING COUNT(DISTINCT c.id) = (SELECT COUNT(*) FROM classes)
       )
       SELECT st.id,
              st.full_name,
              st.phone,
              la.class_name,
              la.class_date
       FROM students st
       LEFT JOIN last_attendance la
         ON la.student_id = st.id
        AND la.rn = 1
       WHERE st.active = false
         AND st.id NOT IN (SELECT student_id FROM completed)
       ORDER BY st.full_name ASC`
    );

    successResponse(res, result.rows, "Inactive report fetched successfully");
  } catch (error) {
    console.error("Inactive report error:", error);
    errorResponse(res, "Failed to fetch inactive report", 500);
  }
};

export const getEligibleReport = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT st.id,
              st.full_name,
              st.phone,
              COUNT(DISTINCT c.id) as attended_classes
       FROM students st
       LEFT JOIN attendance a
         ON a.student_id = st.id
        AND a.status = 'present'
       LEFT JOIN class_sessions s ON s.id = a.session_id
       LEFT JOIN classes c ON c.id = s.class_id
       GROUP BY st.id, st.full_name, st.phone
       HAVING COUNT(DISTINCT c.id) >= 4
       ORDER BY st.full_name ASC`
    );

    successResponse(res, result.rows, "Eligible report fetched successfully");
  } catch (error) {
    console.error("Eligible report error:", error);
    errorResponse(res, "Failed to fetch eligible report", 500);
  }
};
