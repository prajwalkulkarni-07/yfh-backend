import dotenv from "dotenv";
import pool from "./src/config/db.js";

dotenv.config();

const CLASS_ROTATION_START = "2026-05-31";
const CLASS_ROTATION_START_INDEX = 6;
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

const FIRST_NAMES = [
  "Aarav", "Aanya", "Aditya", "Anika", "Arjun", "Diya", "Ishaan", "Isha",
  "Kabir", "Kavya", "Krishna", "Meera", "Neha", "Nisha", "Pooja", "Rahul",
  "Riya", "Rohit", "Sanya", "Sneha", "Tanvi", "Varun", "Vikram", "Yash",
];

const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Singh", "Patel", "Mehta", "Iyer", "Rao",
  "Khan", "Malhotra", "Kapoor", "Joshi", "Nair", "Bose", "Chopra",
];

const INSTITUTIONS = [
  "National College", "City University", "Greenfield Institute", "Riverdale College",
  "Sunrise University", "Metro College", "Oakridge School", "Silverline Academy",
];

const COMPANIES = [
  "Infosys", "TCS", "Wipro", "HCL", "Tech Mahindra", "Capgemini", "Accenture",
  "Cognizant", "Deloitte", "KPMG", "EY", "PwC",
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getArg = (key, fallback) => {
    const idx = args.indexOf(`--${key}`);
    return idx === -1 ? fallback : args[idx + 1] ?? fallback;
  };
  return {
    count: Number(getArg("count", "100")),
    weeks: Number(getArg("weeks", "12")),
    inactiveCount: Number(getArg("inactive", "20")),
  };
};

const parseDate = (value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getClassNameForDate = (classDate) => {
  const date = parseDate(classDate);
  if (!date || date.getUTCDay() !== 0) return null;
  const start = parseDate(CLASS_ROTATION_START);
  if (!start) return null;
  const diffDays = Math.floor((date - start) / (24 * 60 * 60 * 1000));
  if (diffDays % 7 !== 0) return null;
  const weeksOffset = diffDays / 7;
  const index =
    ((weeksOffset + CLASS_ROTATION_START_INDEX) % CLASS_ROTATION.length +
      CLASS_ROTATION.length) %
    CLASS_ROTATION.length;
  return CLASS_ROTATION[index];
};

const toDateKeyUTC = (date) => date.toISOString().slice(0, 10);

const getLastSundays = (weeks) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const day = today.getUTCDay();
  const lastSunday = new Date(today);
  lastSunday.setUTCDate(today.getUTCDate() - day);
  const dates = [];
  for (let i = 0; i < weeks; i += 1) {
    const d = new Date(lastSunday);
    d.setUTCDate(lastSunday.getUTCDate() - 7 * i);
    dates.push(toDateKeyUTC(d));
  }
  return dates;
};

const generatePhone = (index) => {
  const suffix = String(100000 + index).padStart(6, "0");
  return `+91${rand(7000, 9999)}${suffix}`;
};

const main = async () => {
  const { count, weeks, inactiveCount } = parseArgs();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (let i = 0; i < CLASS_ROTATION.length; i += 1) {
      await client.query(
        `INSERT INTO classes (name, order_index)
         VALUES ($1, $2)
         ON CONFLICT (name)
         DO UPDATE SET order_index = EXCLUDED.order_index`,
        [CLASS_ROTATION[i], i + 1]
      );
    }

    const adminResult = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
    );
    const adminId = adminResult.rows[0]?.id ?? null;

    const studentIds = [];
    for (let i = 0; i < count; i += 1) {
      const fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const studentType = Math.random() < 0.55 ? "studying" : "working";
      const age = rand(18, 45);
      const phone = generatePhone(i + 1);
      const institution = studentType === "studying" ? pick(INSTITUTIONS) : null;
      const company = studentType === "working" ? pick(COMPANIES) : null;

      const result = await client.query(
        `INSERT INTO students (full_name, phone, age, student_type, institution_name, company_name, active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id`,
        [fullName, phone, age, studentType, institution, company]
      );
      studentIds.push(result.rows[0].id);
    }

    const sundayDates = getLastSundays(weeks);
    const sessionIds = [];
    for (const classDate of sundayDates) {
      const className = getClassNameForDate(classDate);
      const classIdResult = className
        ? await client.query("SELECT id FROM classes WHERE name = $1", [className])
        : null;
      const classId = classIdResult?.rows[0]?.id ?? null;

      const sessionResult = await client.query(
        `INSERT INTO class_sessions (class_date, day_of_week, class_id, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (class_date)
         DO UPDATE SET class_id = EXCLUDED.class_id
         RETURNING id`,
        [classDate, "Sunday", classId, adminId]
      );
      sessionIds.push({ id: sessionResult.rows[0].id, date: classDate });
    }

    const inactiveIds = new Set();
    while (inactiveIds.size < Math.min(inactiveCount, studentIds.length)) {
      inactiveIds.add(studentIds[rand(0, studentIds.length - 1)]);
    }

    for (let s = 0; s < sessionIds.length; s += 1) {
      const session = sessionIds[s];
      const isLastTwo = s < 2; // sundayDates is latest first
      for (const studentId of studentIds) {
        let status = "present";
        if (inactiveIds.has(studentId) && isLastTwo) {
          status = "absent";
        } else {
          const presentChance = inactiveIds.has(studentId) ? 0.3 : 0.7;
          status = Math.random() < presentChance ? "present" : "absent";
        }

        await client.query(
          `INSERT INTO attendance (session_id, student_id, status, marked_by, marked_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (session_id, student_id)
           DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = NOW()`,
          [session.id, studentId, status, adminId]
        );
      }
    }

    if (inactiveIds.size > 0) {
      await client.query(
        `UPDATE students SET active = false WHERE id = ANY($1::uuid[])`,
        [Array.from(inactiveIds)]
      );
    }

    await client.query("COMMIT");
    console.log(`Seeded ${count} students, ${sessionIds.length} sessions, attendance for all students.`);
    console.log(`Inactive students: ${inactiveIds.size}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to seed data:", error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
};

main();
