import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { promoteEligibleStudents } from "../utils/promotions.js";

export const getInactiveReport = async (_req, res) => {
  try {
    await promoteEligibleStudents(pool);

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
         AND st.level = 1
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
    await promoteEligibleStudents(pool);

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
       WHERE st.level = 1
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

export const getPromotedReport = async (_req, res) => {
  try {
    await promoteEligibleStudents(pool);

    const result = await pool.query(
      `WITH last_trip AS (
         SELECT tp.student_id, MAX(t.trip_date) as trip_date
         FROM trip_participants tp
         INNER JOIN trips t ON t.id = tp.trip_id
         WHERE t.trip_date < CURRENT_DATE
         GROUP BY tp.student_id
       )
       SELECT st.id,
              st.full_name,
              st.phone,
              st.promoted_at,
              lt.trip_date
       FROM students st
       LEFT JOIN last_trip lt ON lt.student_id = st.id
       WHERE st.level >= 2
       ORDER BY st.promoted_at DESC NULLS LAST, st.full_name ASC`
    );

    successResponse(res, result.rows, "Promoted report fetched successfully");
  } catch (error) {
    console.error("Promoted report error:", error);
    errorResponse(res, "Failed to fetch promoted report", 500);
  }
};

export const getYetToAttendTripReport = async (_req, res) => {
  try {
    await promoteEligibleStudents(pool);

    const result = await pool.query(
      `WITH completed_classes AS (
         SELECT a.student_id
         FROM attendance a
         INNER JOIN class_sessions s ON s.id = a.session_id
         INNER JOIN classes c ON c.id = s.class_id
         WHERE a.status = 'present'
         GROUP BY a.student_id
         HAVING COUNT(DISTINCT c.id) = (SELECT COUNT(*) FROM classes)
       ),
       attended_trip AS (
         SELECT DISTINCT tp.student_id
         FROM trip_participants tp
         INNER JOIN trips t ON t.id = tp.trip_id
         WHERE t.trip_date < CURRENT_DATE
       )
       SELECT st.id,
              st.full_name,
              st.phone
       FROM students st
       INNER JOIN completed_classes cc ON cc.student_id = st.id
       LEFT JOIN attended_trip at ON at.student_id = st.id
       WHERE st.level = 1
         AND at.student_id IS NULL
       ORDER BY st.full_name ASC`
    );

    successResponse(res, result.rows, "Yet to attend trip report fetched successfully");
  } catch (error) {
    console.error("Yet to attend trip report error:", error);
    errorResponse(res, "Failed to fetch yet to attend trip report", 500);
  }
};
