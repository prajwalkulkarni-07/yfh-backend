import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { promoteEligibleStudents } from "../utils/promotions.js";

export const getInactiveReport = async (_req, res) => {
  try {
    await promoteEligibleStudents(pool);

    const result = await pool.query(
      `WITH latest_session AS (
         SELECT id, class_date
         FROM class_sessions
         ORDER BY class_date DESC
         LIMIT 1
       ),
       latest_attendance AS (
         SELECT a.student_id, a.status
         FROM attendance a
         INNER JOIN latest_session ls ON ls.id = a.session_id
       ),
       last_present AS (
         SELECT a.student_id,
                s.class_date::text as class_date,
                c.name as class_name,
                ROW_NUMBER() OVER (
                  PARTITION BY a.student_id
                  ORDER BY s.class_date DESC, a.marked_at DESC
                ) AS rn
         FROM attendance a
         INNER JOIN class_sessions s ON s.id = a.session_id
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE a.status = 'present'
       )
       SELECT st.id,
              st.full_name,
              st.phone,
              lp.class_name,
              lp.class_date
       FROM students st
       CROSS JOIN latest_session ls
       LEFT JOIN latest_attendance la ON la.student_id = st.id
       LEFT JOIN last_present lp
         ON lp.student_id = st.id
        AND lp.rn = 1
       WHERE COALESCE(la.status, 'absent') <> 'present'
         AND st.level = 1
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
       HAVING COUNT(DISTINCT c.id) >= 1
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
       ),
       volunteered AS (
         SELECT DISTINCT vp.student_id
         FROM volunteering_participants vp
         INNER JOIN volunteering_services vs ON vs.id = vp.service_id
       ),
       last_trip AS (
         SELECT tp.student_id, MAX(t.trip_date) as trip_date
         FROM trip_participants tp
         INNER JOIN trips t ON t.id = tp.trip_id
         GROUP BY tp.student_id
       )
       SELECT st.id,
              st.full_name,
              st.phone,
              st.promoted_at,
              lt.trip_date::text as trip_date
       FROM students st
       INNER JOIN completed_classes cc ON cc.student_id = st.id
       INNER JOIN attended_trip at ON at.student_id = st.id
       INNER JOIN volunteered v ON v.student_id = st.id
       LEFT JOIN last_trip lt ON lt.student_id = st.id
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
         SELECT a.student_id,
                COUNT(DISTINCT c.id) as attended_classes
         FROM attendance a
         INNER JOIN class_sessions s ON s.id = a.session_id
         INNER JOIN classes c ON c.id = s.class_id
         WHERE a.status = 'present'
         GROUP BY a.student_id
         HAVING COUNT(DISTINCT c.id) >= 4
       ),
       attended_trip AS (
         SELECT DISTINCT tp.student_id
         FROM trip_participants tp
         INNER JOIN trips t ON t.id = tp.trip_id
       )
       SELECT st.id,
              st.full_name,
              st.phone,
              cc.attended_classes
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

export const getYetToVolunteerReport = async (_req, res) => {
  try {
    await promoteEligibleStudents(pool);

    const result = await pool.query(
      `WITH completed_classes AS (
         SELECT a.student_id,
                COUNT(DISTINCT c.id) as attended_classes
         FROM attendance a
         INNER JOIN class_sessions s ON s.id = a.session_id
         INNER JOIN classes c ON c.id = s.class_id
         WHERE a.status = 'present'
         GROUP BY a.student_id
         HAVING COUNT(DISTINCT c.id) >= 4
       ),
       volunteered AS (
         SELECT DISTINCT vp.student_id
         FROM volunteering_participants vp
         INNER JOIN volunteering_services vs ON vs.id = vp.service_id
       )
       SELECT st.id,
              st.full_name,
              st.phone,
              cc.attended_classes
       FROM students st
       INNER JOIN completed_classes cc ON cc.student_id = st.id
       LEFT JOIN volunteered v ON v.student_id = st.id
       WHERE st.level = 1
         AND v.student_id IS NULL
       ORDER BY st.full_name ASC`
    );

    successResponse(res, result.rows, "Yet to volunteer report fetched successfully");
  } catch (error) {
    console.error("Yet to volunteer report error:", error);
    errorResponse(res, "Failed to fetch yet to volunteer report", 500);
  }
};
