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

const syncActivityStatus = async () => {
  await pool.query(
    `WITH recent_attendance AS (
       SELECT a.student_id,
              a.status,
              ROW_NUMBER() OVER (
                PARTITION BY a.student_id
                ORDER BY s.class_date DESC, a.marked_at DESC
              ) as rn
       FROM attendance a
       INNER JOIN class_sessions s ON s.id = a.session_id
     ),
     activity AS (
       SELECT student_id,
              COUNT(*) FILTER (WHERE rn <= 4) as checked_classes,
              COUNT(*) FILTER (WHERE rn <= 4 AND status = 'absent') as missed_classes,
              MAX(CASE WHEN rn = 1 THEN status END) as latest_status
       FROM recent_attendance
       WHERE rn <= 4
       GROUP BY student_id
     )
     UPDATE students st
     SET active = CASE
       WHEN activity.checked_classes = 4 AND activity.missed_classes = 4 THEN false
       ELSE true
     END
     FROM students target
     LEFT JOIN activity ON activity.student_id = target.id
     WHERE st.id = target.id
       AND st.level = 1`
  );
};

const prepareReports = async () => {
  await ensureClasses();
  await syncActivityStatus();
  await promoteEligibleStudents(pool);
};

export const getInactiveReport = async (_req, res) => {
  try {
    await prepareReports();

    const result = await pool.query(
      `WITH last_present AS (
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
       LEFT JOIN last_present lp
         ON lp.student_id = st.id
        AND lp.rn = 1
       WHERE st.active = false
         AND st.level = 1
       ORDER BY st.full_name ASC`
    );

    successResponse(res, result.rows, "Inactive report fetched successfully");
  } catch (error) {
    console.error("Inactive report error:", error);
    errorResponse(res, "Failed to fetch inactive report", 500);
  }
};

export const getEligibleReport = async (req, res) => {
  try {
    await prepareReports();
    const status = req.query.status === "not_eligible" ? "not_eligible" : "eligible";
    const comparator = status === "eligible" ? ">=" : "<";

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
       HAVING COUNT(DISTINCT c.id) ${comparator} 4
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
    await prepareReports();

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

export const getReportByClass = async (_req, res) => {
  try {
    await prepareReports();

    const result = await pool.query(
      `WITH all_level_1_students AS (
         SELECT id, full_name, phone
         FROM students
         WHERE level = 1
       ),
       attended AS (
         SELECT DISTINCT a.student_id, c.id as class_id
         FROM attendance a
         INNER JOIN class_sessions s ON s.id = a.session_id
         INNER JOIN classes c ON c.id = s.class_id
         WHERE a.status = 'present'
       )
       SELECT c.id as class_id,
              c.name as class_name,
              c.order_index,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'id', st.id,
                    'full_name', st.full_name,
                    'phone', st.phone
                  )
                  ORDER BY LOWER(st.full_name), st.full_name
                ) FILTER (WHERE st.id IS NOT NULL AND at.student_id IS NULL),
                '[]'::json
              ) as students
       FROM classes c
       CROSS JOIN all_level_1_students st
       LEFT JOIN attended at
         ON at.student_id = st.id
        AND at.class_id = c.id
       GROUP BY c.id, c.name, c.order_index
       ORDER BY c.order_index ASC`
    );

    successResponse(res, result.rows, "Class report fetched successfully");
  } catch (error) {
    console.error("Class report error:", error);
    errorResponse(res, "Failed to fetch class report", 500);
  }
};

export const getAllStudentsReport = async (_req, res) => {
  try {
    await prepareReports();

    const result = await pool.query(
      `WITH class_attendance AS (
         SELECT a.student_id,
                c.id as class_id
         FROM attendance a
         INNER JOIN class_sessions s ON s.id = a.session_id
         INNER JOIN classes c ON c.id = s.class_id
         WHERE a.status = 'present'
         GROUP BY a.student_id, c.id
       ),
       class_status AS (
         SELECT st.id as student_id,
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'class_id', c.id,
                    'class_name', c.name,
                    'order_index', c.order_index,
                    'status', CASE WHEN ca.student_id IS NULL THEN 'Not Attended' ELSE 'Attended' END
                  )
                  ORDER BY c.order_index
                ) as classes
         FROM students st
         CROSS JOIN classes c
         LEFT JOIN class_attendance ca
           ON ca.student_id = st.id
          AND ca.class_id = c.id
         GROUP BY st.id
       ),
       trip_status AS (
         SELECT DISTINCT student_id
         FROM trip_participants
       ),
       volunteering_status AS (
         SELECT DISTINCT student_id
         FROM volunteering_participants
       )
       SELECT st.id,
              st.full_name,
              st.phone,
              cs.classes,
              CASE WHEN ts.student_id IS NULL THEN 'Not Attended' ELSE 'Attended' END as trip,
              CASE WHEN vs.student_id IS NULL THEN 'Not Done' ELSE 'Done' END as volunteering,
              CASE WHEN st.active THEN 'Active' ELSE 'Inactive' END as activity_status,
              CASE WHEN COALESCE(st.level, 1) >= 2 THEN 'Promoted' ELSE 'Not Promoted' END as promotion_status
       FROM students st
       INNER JOIN class_status cs ON cs.student_id = st.id
       LEFT JOIN trip_status ts ON ts.student_id = st.id
       LEFT JOIN volunteering_status vs ON vs.student_id = st.id
       ORDER BY LOWER(st.full_name), st.full_name`
    );

    successResponse(res, result.rows, "All students report fetched successfully");
  } catch (error) {
    console.error("All students report error:", error);
    errorResponse(res, "Failed to fetch all students report", 500);
  }
};

export const getYetToAttendTripReport = async (_req, res) => {
  try {
    await prepareReports();

    const result = await pool.query(
      `WITH completed_classes AS (
         SELECT a.student_id, COUNT(DISTINCT c.id) as attended_classes
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
    await prepareReports();

    const result = await pool.query(
      `WITH volunteered AS (
         SELECT DISTINCT vp.student_id
         FROM volunteering_participants vp
         INNER JOIN volunteering_services vs ON vs.id = vp.service_id
       )
       SELECT st.id,
              st.full_name,
              st.phone
       FROM students st
       LEFT JOIN volunteered v ON v.student_id = st.id
       WHERE v.student_id IS NULL
       ORDER BY st.full_name ASC`
    );

    successResponse(res, result.rows, "Yet to volunteer report fetched successfully");
  } catch (error) {
    console.error("Yet to volunteer report error:", error);
    errorResponse(res, "Failed to fetch yet to volunteer report", 500);
  }
};
