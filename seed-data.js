import dotenv from "dotenv"
import pool from "./src/config/db.js"

dotenv.config()

const CLASS_ROTATION = [
  "Self Management",
  "Yoga",
  "Relationship",
  "Karma",
  "Diet For Happiness",
  "Habits For Happiness",
  "The Perfect Knowledge",
  "The Real Freedom",
]

const SESSION_END_DATE = "2026-05-31"
const SESSION_COUNT = 8
const PROMOTED_AT = "2026-05-31T18:00:00Z"
const PROMOTION_TRIP_DATE = "2026-05-24"

const parseDate = (value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const toDateKeyUTC = (date) => date.toISOString().slice(0, 10)

const getSessionDates = (count) => {
  const endDate = parseDate(SESSION_END_DATE)
  if (!endDate) {
    throw new Error(`Invalid session end date: ${SESSION_END_DATE}`)
  }

  const dates = []
  for (let i = 0; i < count; i += 1) {
    const date = new Date(endDate)
    date.setUTCDate(endDate.getUTCDate() - 7 * i)
    dates.push(toDateKeyUTC(date))
  }
  return dates
}

const getClassNameForDate = (classDate) => {
  const date = parseDate(classDate)
  if (!date || date.getUTCDay() !== 0) return null

  const endDate = parseDate(SESSION_END_DATE)
  if (!endDate) return null

  const diffDays = Math.floor((endDate - date) / (24 * 60 * 60 * 1000))
  if (diffDays % 7 !== 0) return null

  const weeksOffset = diffDays / 7
  const index = (6 - weeksOffset + CLASS_ROTATION.length * 100) % CLASS_ROTATION.length
  return CLASS_ROTATION[index]
}

const STUDENT_SEEDS = [
  {
    full_name: "Aarav Sharma",
    phone: "9000000001",
    age: 19,
    student_type: "studying",
    college_name: "National College",
    branch: "Computer Science",
    semester: 6,
    active: true,
    attendance: ["present", "present", "present", "present", "present", "present", "present", "present"],
  },
  {
    full_name: "Anika Rao",
    phone: "9000000002",
    age: 20,
    student_type: "studying",
    college_name: "City University",
    branch: "Electronics",
    semester: 4,
    active: true,
    attendance: ["present", "present", "present", "present", "present", "present", "absent", "present"],
  },
  {
    full_name: "Kabir Patel",
    phone: "9000000003",
    age: 21,
    student_type: "studying",
    college_name: "Greenfield Institute",
    branch: "Mechanical",
    semester: 2,
    active: true,
    attendance: ["present", "present", "present", "absent", "present", "present", "present", "present"],
  },
  {
    full_name: "Diya Joshi",
    phone: "9000000004",
    age: 19,
    student_type: "studying",
    college_name: "Metro College",
    branch: "Information Technology",
    semester: 8,
    active: true,
    attendance: ["present", "present", "present", "present", "absent", "present", "present", "present"],
  },
  {
    full_name: "Isha Khan",
    phone: "9000000005",
    age: 22,
    student_type: "studying",
    college_name: "Oakridge College",
    branch: "Electrical",
    semester: 5,
    active: false,
    attendance: ["absent", "absent", "present", "absent", "absent", "absent", "present", "absent"],
  },
  {
    full_name: "Yash Bose",
    phone: "9000000006",
    age: 18,
    student_type: "studying",
    college_name: "Silverline Academy",
    branch: "Commerce",
    semester: 3,
    active: false,
    attendance: ["absent", "present", "absent", "absent", "absent", "absent", "absent", "absent"],
  },
  {
    full_name: "Rahul Mehta",
    phone: "9000000007",
    age: 28,
    student_type: "working",
    company_name: "Infosys",
    designation: "Software Engineer",
    experience: 3.5,
    active: true,
    attendance: ["present", "present", "present", "present", "present", "absent", "present", "present"],
  },
  {
    full_name: "Sneha Singh",
    phone: "9000000008",
    age: 26,
    student_type: "working",
    company_name: "TCS",
    designation: "Analyst",
    experience: 1.5,
    active: true,
    attendance: ["present", "present", "present", "present", "absent", "present", "present", "absent"],
  },
  {
    full_name: "Varun Nair",
    phone: "9000000009",
    age: 31,
    student_type: "working",
    company_name: "Wipro",
    designation: "Consultant",
    experience: 5,
    active: true,
    attendance: ["present", "present", "absent", "present", "present", "present", "present", "absent"],
  },
  {
    full_name: "Riya Kapoor",
    phone: "9000000010",
    age: 27,
    student_type: "working",
    company_name: "HCL",
    designation: "Associate",
    experience: 3,
    active: false,
    attendance: ["absent", "present", "absent", "absent", "absent", "absent", "absent", "present"],
  },
  {
    full_name: "Aditya Gupta",
    phone: "9000000011",
    age: 24,
    student_type: "working",
    company_name: "Accenture",
    designation: "Developer",
    experience: 1.5,
    active: false,
    attendance: ["absent", "absent", "absent", "absent", "present", "absent", "absent", "absent"],
  },
  {
    full_name: "Meera Verma",
    phone: "9000000012",
    age: 22,
    student_type: "studying",
    college_name: "Riverdale College",
    branch: "Psychology",
    semester: 8,
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
  },
  {
    full_name: "Tanvi Chopra",
    phone: "9000000013",
    age: 23,
    student_type: "studying",
    college_name: "Sunrise University",
    branch: "Commerce",
    semester: 8,
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
  },
  {
    full_name: "Arjun Iyer",
    phone: "9000000014",
    age: 33,
    student_type: "working",
    company_name: "Deloitte",
    designation: "Lead Engineer",
    experience: 6,
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
  },
  {
    full_name: "Nisha Gupta",
    phone: "9000000015",
    age: 29,
    student_type: "working",
    company_name: "EY",
    designation: "Manager",
    experience: 7,
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
  },
]

const main = async () => {
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    await client.query(
      "TRUNCATE TABLE attendance, trip_participants, class_sessions, trips, students, classes RESTART IDENTITY CASCADE"
    )

    for (let i = 0; i < CLASS_ROTATION.length; i += 1) {
      await client.query(
        `INSERT INTO classes (name, order_index)
         VALUES ($1, $2)`,
        [CLASS_ROTATION[i], i + 1]
      )
    }

    const adminResult = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
    )
    const adminId = adminResult.rows[0]?.id ?? null

    if (!adminId) {
      throw new Error("No admin user found. Create an admin first.")
    }

    const sessionDates = getSessionDates(SESSION_COUNT)
    const sessions = []

    for (const classDate of sessionDates) {
      const className = getClassNameForDate(classDate)
      if (!className) {
        throw new Error(`Could not resolve class name for ${classDate}`)
      }

      const classResult = await client.query("SELECT id FROM classes WHERE name = $1", [className])
      const classId = classResult.rows[0]?.id ?? null

      if (!classId) {
        throw new Error(`Missing class row for ${className}`)
      }

      const sessionResult = await client.query(
        `INSERT INTO class_sessions (class_date, day_of_week, class_id, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [classDate, "Sunday", classId, adminId]
      )

      sessions.push({ id: sessionResult.rows[0].id, date: classDate, className })
    }

    const insertedStudents = []
    const promotedStudentIds = []

    for (const student of STUDENT_SEEDS) {
      const result = await client.query(
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
           experience,
           active,
           level,
           promoted_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          student.full_name,
          student.phone,
          student.age,
          student.student_type,
          student.student_type === "studying" ? student.college_name : null,
          student.student_type === "studying" ? student.branch : null,
          student.student_type === "studying" ? student.semester : null,
          student.student_type === "working" ? student.company_name : null,
          student.student_type === "working" ? student.designation : null,
          student.student_type === "working" ? student.experience : null,
          student.active ?? true,
          student.level ?? 1,
          student.promoted_at ?? null,
        ]
      )

      const studentId = result.rows[0].id
      insertedStudents.push({ id: studentId, ...student })

      if ((student.level ?? 1) >= 2) {
        promotedStudentIds.push(studentId)
      }
    }

    for (const [sessionIndex, session] of sessions.entries()) {
      for (const student of insertedStudents) {
        if ((student.level ?? 1) >= 2) {
          continue
        }

        const status = student.attendance?.[sessionIndex] ?? "absent"
        await client.query(
          `INSERT INTO attendance (session_id, student_id, status, marked_by, marked_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (session_id, student_id)
           DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = EXCLUDED.marked_at`,
          [session.id, student.id, status, adminId, `${session.date}T09:00:00Z`]
        )
      }
    }

    const tripResult = await client.query(
      `INSERT INTO trips (trip_date, details, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [PROMOTION_TRIP_DATE, "Promotion retreat", adminId]
    )
    const tripId = tripResult.rows[0].id

    for (const studentId of promotedStudentIds) {
      await client.query(
        `INSERT INTO trip_participants (trip_id, student_id, added_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (trip_id, student_id) DO NOTHING`,
        [tripId, studentId, `${PROMOTION_TRIP_DATE}T10:00:00Z`]
      )
    }

    await client.query("COMMIT")

    const totalStudying = STUDENT_SEEDS.filter((student) => student.student_type === "studying").length
    const totalWorking = STUDENT_SEEDS.filter((student) => student.student_type === "working").length
    const activeCount = STUDENT_SEEDS.filter((student) => (student.level ?? 1) === 1 && student.active).length
    const inactiveCount = STUDENT_SEEDS.filter((student) => (student.level ?? 1) === 1 && !student.active).length

    console.log("Seeded test data successfully.")
    console.log(`Students: ${STUDENT_SEEDS.length} total, ${totalStudying} studying, ${totalWorking} working`)
    console.log(`Level 1 active: ${activeCount}, level 1 inactive: ${inactiveCount}, promoted: ${promotedStudentIds.length}`)
    console.log(`Classes/sessions seeded through ${SESSION_END_DATE}. Last attendance date: ${SESSION_END_DATE}`)
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Failed to seed data:", error)
    process.exitCode = 1
  } finally {
    client.release()
  }
}

main()
