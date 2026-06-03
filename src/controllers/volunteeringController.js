import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";

const parseServiceDate = (value) => {
  if (!value || typeof value !== "string") return null;
  const dateOnly = value.split("T")[0];
  const dateObj = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(dateObj.getTime())) return null;
  return dateOnly;
};

const validateStudents = async (client, studentIds) => {
  if (studentIds.length === 0) return [];
  const result = await client.query(
    "SELECT id FROM students WHERE id = ANY($1::uuid[])",
    [studentIds]
  );
  return result.rows.map((row) => row.id);
};

export const listServices = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT vs.id,
              vs.service_date::text as service_date,
              vs.details,
              vs.created_at,
              COUNT(vp.student_id) as participant_count,
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
       FROM volunteering_services vs
       LEFT JOIN volunteering_participants vp ON vp.service_id = vs.id
       LEFT JOIN students st ON st.id = vp.student_id
       GROUP BY vs.id
       ORDER BY vs.service_date DESC`
    );

    successResponse(res, result.rows, "Volunteering services fetched successfully");
  } catch (error) {
    console.error("Get volunteering services error:", error);
    errorResponse(res, "Failed to fetch volunteering services", 500);
  }
};

export const createService = async (req, res) => {
  const client = await pool.connect();
  try {
    const { service_date, student_ids, details } = req.body;
    const parsedDate = parseServiceDate(service_date);
    if (!parsedDate) {
      return errorResponse(res, "service_date is required", 400);
    }

    const serviceDetails =
      details === undefined || details === null ? null : String(details).trim();
    const studentIds = Array.isArray(student_ids)
      ? Array.from(new Set(student_ids))
      : [];

    await client.query("BEGIN");

    const serviceResult = await client.query(
      `INSERT INTO volunteering_services (service_date, details, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, service_date::text as service_date, details, created_at`,
      [parsedDate, serviceDetails || null, req.user.id]
    );

    if (studentIds.length > 0) {
      const validStudents = await validateStudents(client, studentIds);
      if (validStudents.length !== studentIds.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, "One or more students are invalid", 400);
      }

      await client.query(
        `INSERT INTO volunteering_participants (service_id, student_id)
         SELECT $1, UNNEST($2::uuid[])`,
        [serviceResult.rows[0].id, studentIds]
      );
    }

    await promoteEligibleStudents(client);

    await client.query("COMMIT");

    successResponse(
      res,
      { ...serviceResult.rows[0], participant_count: studentIds.length },
      "Volunteering service created successfully",
      201
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create volunteering service error:", error);
    if (String(error.message || "").includes("volunteering_services_service_date_key")) {
      return errorResponse(res, "Volunteering date already scheduled", 409);
    }
    errorResponse(res, "Failed to create volunteering service", 500);
  } finally {
    client.release();
  }
};

export const updateServiceParticipants = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { student_ids, details, service_date } = req.body;
    const studentIds = Array.isArray(student_ids)
      ? Array.from(new Set(student_ids))
      : [];
    const parsedDate = service_date !== undefined ? parseServiceDate(service_date) : null;

    if (service_date !== undefined && !parsedDate) {
      return errorResponse(res, "service_date is invalid", 400);
    }

    await client.query("BEGIN");

    const serviceResult = await client.query(
      "SELECT id, service_date::text as service_date FROM volunteering_services WHERE id = $1",
      [id]
    );

    if (serviceResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Volunteering service not found", 404);
    }

    if (parsedDate && parsedDate !== serviceResult.rows[0].service_date) {
      await client.query(
        "UPDATE volunteering_services SET service_date = $1 WHERE id = $2",
        [parsedDate, id]
      );
    }

    if (details !== undefined) {
      const serviceDetails = details === null ? null : String(details).trim();
      await client.query(
        "UPDATE volunteering_services SET details = $1 WHERE id = $2",
        [serviceDetails || null, id]
      );
    }

    if (studentIds.length > 0) {
      const validStudents = await validateStudents(client, studentIds);
      if (validStudents.length !== studentIds.length) {
        await client.query("ROLLBACK");
        return errorResponse(res, "One or more students are invalid", 400);
      }
    }

    await client.query("DELETE FROM volunteering_participants WHERE service_id = $1", [id]);

    if (studentIds.length > 0) {
      await client.query(
        `INSERT INTO volunteering_participants (service_id, student_id)
         SELECT $1, UNNEST($2::uuid[])`,
        [id, studentIds]
      );
    }

    await promoteEligibleStudents(client);

    await client.query("COMMIT");

    successResponse(
      res,
      { id, participant_count: studentIds.length },
      "Volunteering service updated successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update volunteering service error:", error);
    errorResponse(res, "Failed to update volunteering service", 500);
  } finally {
    client.release();
  }
};

export const deleteService = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const serviceResult = await client.query(
      "SELECT id FROM volunteering_services WHERE id = $1",
      [id]
    );

    if (serviceResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Volunteering service not found", 404);
    }

    await client.query("DELETE FROM volunteering_services WHERE id = $1", [id]);

    await client.query("COMMIT");

    successResponse(res, { id }, "Volunteering service deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete volunteering service error:", error);
    errorResponse(res, "Failed to delete volunteering service", 500);
  } finally {
    client.release();
  }
};