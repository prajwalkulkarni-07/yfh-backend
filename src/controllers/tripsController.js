import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { promoteEligibleStudents } from "../utils/promotions.js";

const parseTripDate = (value) => {
  if (!value || typeof value !== "string") return null;
  const dateOnly = value.split("T")[0];
  const dateObj = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(dateObj.getTime())) return null;
  return dateOnly;
};

const isTripLocked = (tripDate) => {
  const dateOnly = String(tripDate || "").split("T")[0];
  const dateObj = new Date(`${dateOnly}T00:00:00Z`);
  const lockDate = new Date(dateObj);
  lockDate.setUTCDate(lockDate.getUTCDate() - 1);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return lockDate.getTime() <= today.getTime();
};

const validateStudents = async (client, studentIds) => {
  if (studentIds.length === 0) return [];
  const result = await client.query(
    "SELECT id FROM students WHERE id = ANY($1::uuid[]) AND level = 1",
    [studentIds]
  );
  return result.rows.map((row) => row.id);
};

export const listTrips = async (_req, res) => {
  try {
    await promoteEligibleStudents(pool);

    const result = await pool.query(
            `SELECT t.id,
              t.trip_date::text as trip_date,
              t.details,
              t.created_at,
              COUNT(tp.student_id) as participant_count,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', st.id,
                    'full_name', st.full_name,
                    'phone', st.phone
                  )
                  ORDER BY st.full_name
                ) FILTER (WHERE st.id IS NOT NULL),
                '[]'
              ) as participants
       FROM trips t
       LEFT JOIN trip_participants tp ON tp.trip_id = t.id
       LEFT JOIN students st ON st.id = tp.student_id
       GROUP BY t.id
       ORDER BY t.trip_date DESC`
    );

    const data = result.rows.map((row) => ({
      ...row,
      is_locked: isTripLocked(row.trip_date),
    }));

    successResponse(res, data, "Trips fetched successfully");
  } catch (error) {
    console.error("Get trips error:", error);
    errorResponse(res, "Failed to fetch trips", 500);
  }
};

export const createTrip = async (req, res) => {
  const client = await pool.connect();
  try {
    const { trip_date, student_ids, details } = req.body;
    const parsedDate = parseTripDate(trip_date);
    if (!parsedDate) {
      return errorResponse(res, "trip_date is required", 400);
    }

    const tripDetails =
      details === undefined || details === null ? null : String(details).trim();

    const studentIds = Array.isArray(student_ids)
      ? Array.from(new Set(student_ids))
      : [];

    await client.query("BEGIN");

    const tripResult = await client.query(
      `INSERT INTO trips (trip_date, details, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, trip_date::text as trip_date, details, created_at`,
      [parsedDate, tripDetails || null, req.user.id]
    );

    if (studentIds.length > 0) {
      const validStudents = await validateStudents(client, studentIds);
      if (validStudents.length !== studentIds.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, "One or more students are invalid", 400);
      }

      await client.query(
        `INSERT INTO trip_participants (trip_id, student_id)
         SELECT $1, UNNEST($2::uuid[])`,
        [tripResult.rows[0].id, studentIds]
      );
    }

    await promoteEligibleStudents(client);
    await client.query("COMMIT");

    successResponse(
      res,
      { ...tripResult.rows[0], participant_count: studentIds.length },
      "Trip created successfully",
      201
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create trip error:", error);
    if (String(error.message || "").includes("trips_trip_date_key")) {
      return errorResponse(res, "Trip date already scheduled", 409);
    }
    errorResponse(res, "Failed to create trip", 500);
  } finally {
    client.release();
  }
};

export const updateTripParticipants = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { student_ids, details } = req.body;
    const studentIds = Array.isArray(student_ids)
      ? Array.from(new Set(student_ids))
      : [];

    await client.query("BEGIN");

    const tripResult = await client.query(
      "SELECT id, trip_date::text as trip_date FROM trips WHERE id = $1",
      [id]
    );

    if (tripResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Trip not found", 404);
    }

    const tripDate = tripResult.rows[0].trip_date;
    if (isTripLocked(tripDate)) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Trip is locked for changes", 400);
    }

    if (details !== undefined) {
      const tripDetails = details === null ? null : String(details).trim();
      await client.query(
        "UPDATE trips SET details = $1 WHERE id = $2",
        [tripDetails || null, id]
      );
    }

    if (studentIds.length > 0) {
      const validStudents = await validateStudents(client, studentIds);
      if (validStudents.length !== studentIds.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, "One or more students are invalid", 400);
      }
    }

    await client.query("DELETE FROM trip_participants WHERE trip_id = $1", [id]);

    if (studentIds.length > 0) {
      await client.query(
        `INSERT INTO trip_participants (trip_id, student_id)
         SELECT $1, UNNEST($2::uuid[])`,
        [id, studentIds]
      );
    }

    await promoteEligibleStudents(client);
    await client.query("COMMIT");

    successResponse(
      res,
      { id, participant_count: studentIds.length },
      "Trip updated successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update trip error:", error);
    errorResponse(res, "Failed to update trip", 500);
  } finally {
    client.release();
  }
};

export const deleteTrip = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const tripResult = await client.query(
      "SELECT id, trip_date::text as trip_date FROM trips WHERE id = $1",
      [id]
    );

    if (tripResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Trip not found", 404);
    }

    const tripDate = tripResult.rows[0].trip_date;
    if (isTripLocked(tripDate)) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Trip is locked for changes", 400);
    }

    await client.query("DELETE FROM trips WHERE id = $1", [id]);

    await promoteEligibleStudents(client);
    await client.query("COMMIT");

    successResponse(res, { id }, "Trip deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete trip error:", error);
    errorResponse(res, "Failed to delete trip", 500);
  } finally {
    client.release();
  }
};
