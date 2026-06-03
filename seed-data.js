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

const YFH_SESSION_DATES = [
  "2026-04-12",
  "2026-04-19",
  "2026-04-26",
  "2026-05-03",
  "2026-05-10",
  "2026-05-17",
  "2026-05-24",
  "2026-05-31",
]

const GITA_SESSION_DATES = [
  "2026-05-17",
  "2026-05-24",
  "2026-05-31",
]

const PROMOTED_AT = "2026-05-31T18:00:00Z"

const TRIPS = [
  { key: "mayTrip", date: "2026-05-24", details: "Pre-promotion trip to Srirangapatna" },
  { key: "aprilTrip", date: "2026-04-26", details: "Temple visit and outdoor satsanga" },
]

const VOLUNTEERING_SERVICES = [
  { key: "mayService", date: "2026-05-30", details: "Sunday class hall setup and prasadam service" },
  { key: "aprilService", date: "2026-04-20", details: "Book table and community service" },
]

const allPresent = () => Array(YFH_SESSION_DATES.length).fill("present")

const absentAt = (...indexes) => {
  const attendance = allPresent()
  for (const index of indexes) {
    attendance[index] = "absent"
  }
  return attendance
}

const sparseAttendance = (presentIndexes) =>
  YFH_SESSION_DATES.map((_, index) =>
    presentIndexes.includes(index) ? "present" : "absent"
  )

const toEmail = (name, index) =>
  `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.+|\.+$/g, "")}${index}@example.com`

const studying = (index, fullName, overrides = {}) => ({
  full_name: fullName,
  email: toEmail(fullName, index),
  phone: `900100${String(index).padStart(4, "0")}`,
  age: overrides.age ?? 19 + (index % 6),
  student_type: "studying",
  college_name: overrides.college_name ?? [
    "National College",
    "City University",
    "Greenfield Institute",
    "Metro College",
    "Oakridge College",
  ][index % 5],
  branch: overrides.branch ?? [
    "Computer Science",
    "Electronics",
    "Mechanical",
    "Commerce",
    "Information Technology",
  ][index % 5],
  semester: overrides.semester ?? (index % 8) + 1,
  active: overrides.active ?? true,
  level: overrides.level ?? 1,
  promoted_at: overrides.promoted_at ?? null,
  attendance: overrides.attendance ?? sparseAttendance([0, 2, 4, 6]),
  trips: overrides.trips ?? [],
  volunteering: overrides.volunteering ?? [],
  gitaAttendance: overrides.gitaAttendance ?? null,
})

const working = (index, fullName, overrides = {}) => ({
  full_name: fullName,
  email: toEmail(fullName, index),
  phone: `900100${String(index).padStart(4, "0")}`,
  age: overrides.age ?? 24 + (index % 12),
  student_type: "working",
  company_name: overrides.company_name ?? [
    "Infosys",
    "TCS",
    "Wipro",
    "Accenture",
    "Deloitte",
    "Zoho",
  ][index % 6],
  designation: overrides.designation ?? [
    "Software Engineer",
    "Analyst",
    "Consultant",
    "Associate",
    "Product Specialist",
    "Operations Lead",
  ][index % 6],
  experience: overrides.experience ?? Number((1 + (index % 8) * 0.75).toFixed(2)),
  active: overrides.active ?? true,
  level: overrides.level ?? 1,
  promoted_at: overrides.promoted_at ?? null,
  attendance: overrides.attendance ?? sparseAttendance([1, 3, 5, 7]),
  trips: overrides.trips ?? [],
  volunteering: overrides.volunteering ?? [],
  gitaAttendance: overrides.gitaAttendance ?? null,
})

const STUDENT_SEEDS = [
  studying(1, "Aarav Sharma", {
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
    attendance: allPresent(),
    trips: ["mayTrip"],
    volunteering: ["mayService"],
    gitaAttendance: ["present", "present", "present"],
  }),
  studying(2, "Anika Rao", {
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
    attendance: allPresent(),
    trips: ["mayTrip"],
    volunteering: ["mayService"],
    gitaAttendance: ["present", "absent", "present"],
  }),
  working(3, "Kabir Patel", {
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
    attendance: allPresent(),
    trips: ["aprilTrip"],
    volunteering: ["mayService"],
    gitaAttendance: ["absent", "present", "present"],
  }),
  working(4, "Diya Joshi", {
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
    attendance: allPresent(),
    trips: ["mayTrip"],
    volunteering: ["aprilService"],
    gitaAttendance: ["present", "present", "absent"],
  }),
  studying(5, "Isha Khan", {
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
    attendance: allPresent(),
    trips: ["aprilTrip"],
    volunteering: ["aprilService"],
    gitaAttendance: ["present", "present", "present"],
  }),
  working(6, "Rahul Mehta", {
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
    attendance: allPresent(),
    trips: ["mayTrip"],
    volunteering: ["mayService"],
    gitaAttendance: ["absent", "absent", "present"],
  }),
  studying(7, "Meera Verma", {
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
    attendance: allPresent(),
    trips: ["mayTrip"],
    volunteering: ["aprilService"],
    gitaAttendance: ["present", "absent", "absent"],
  }),
  working(8, "Arjun Iyer", {
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
    attendance: allPresent(),
    trips: ["aprilTrip"],
    volunteering: ["mayService"],
    gitaAttendance: ["present", "present", "present"],
  }),
  studying(9, "Nisha Gupta", {
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
    attendance: allPresent(),
    trips: ["mayTrip"],
    volunteering: ["mayService"],
    gitaAttendance: ["absent", "present", "absent"],
  }),
  working(10, "Varun Nair", {
    active: false,
    level: 2,
    promoted_at: PROMOTED_AT,
    attendance: allPresent(),
    trips: ["mayTrip"],
    volunteering: ["mayService"],
    gitaAttendance: ["present", "absent", "present"],
  }),

  studying(11, "Riya Kapoor", {
    attendance: allPresent(),
    trips: ["mayTrip"],
  }),
  working(12, "Aditya Gupta", {
    attendance: allPresent(),
    trips: ["aprilTrip"],
  }),
  studying(13, "Tanvi Chopra", {
    attendance: allPresent(),
    trips: ["mayTrip"],
  }),
  working(14, "Yash Bose", {
    attendance: allPresent(),
    trips: ["aprilTrip"],
  }),
  studying(15, "Sneha Singh", {
    attendance: allPresent(),
    trips: ["mayTrip"],
  }),
  working(16, "Dev Malhotra", {
    active: false,
    attendance: allPresent(),
    trips: ["aprilTrip"],
  }),

  studying(17, "Pooja Menon", {
    attendance: allPresent(),
    volunteering: ["mayService"],
  }),
  working(18, "Rohan Das", {
    attendance: allPresent(),
    volunteering: ["aprilService"],
  }),
  studying(19, "Kavya Reddy", {
    attendance: allPresent(),
    volunteering: ["mayService"],
  }),
  working(20, "Sahil Jain", {
    attendance: allPresent(),
    volunteering: ["aprilService"],
  }),
  studying(21, "Neha Kulkarni", {
    active: false,
    attendance: allPresent(),
    volunteering: ["mayService"],
  }),
  working(22, "Manav Sethi", {
    attendance: allPresent(),
    volunteering: ["mayService"],
  }),

  studying(23, "Prisha Nambiar", {
    attendance: absentAt(1),
    trips: ["mayTrip"],
    volunteering: ["mayService"],
  }),
  working(24, "Kunal Bhat", {
    attendance: absentAt(3),
    trips: ["aprilTrip"],
    volunteering: ["aprilService"],
  }),
  studying(25, "Avni Mishra", {
    attendance: absentAt(5),
    trips: ["mayTrip"],
    volunteering: ["mayService"],
  }),
  working(26, "Harsh Vardhan", {
    attendance: absentAt(7),
    trips: ["aprilTrip"],
    volunteering: ["mayService"],
  }),
  studying(27, "Myra Saxena", {
    active: false,
    attendance: absentAt(0, 6),
    trips: ["mayTrip"],
    volunteering: ["aprilService"],
  }),
  working(28, "Omkar Shetty", {
    attendance: absentAt(2, 4),
    trips: ["mayTrip"],
    volunteering: ["mayService"],
  }),

  studying(29, "Saanvi Bansal", {
    attendance: sparseAttendance([0, 1, 2, 3]),
  }),
  working(30, "Nikhil Chawla", {
    attendance: sparseAttendance([4, 5, 6, 7]),
  }),
  studying(31, "Kiara Dutta", {
    attendance: sparseAttendance([0, 2, 5]),
  }),
  working(32, "Vivaan Murthy", {
    attendance: sparseAttendance([1, 3, 6]),
  }),
  studying(33, "Aditi Pillai", {
    attendance: sparseAttendance([2, 4, 7]),
  }),
  working(34, "Ishaan Roy", {
    attendance: sparseAttendance([0, 5, 7]),
  }),
  studying(35, "Sara Thomas", {
    active: false,
    attendance: sparseAttendance([1, 4]),
  }),
  working(36, "Aryan Suresh", {
    active: false,
    attendance: sparseAttendance([3, 6]),
  }),
  studying(37, "Mira Fernandes", {
    attendance: sparseAttendance([0, 7]),
  }),
  working(38, "Reyansh Shah", {
    attendance: sparseAttendance([2, 5]),
  }),
  studying(39, "Tara Krishnan", {
    attendance: sparseAttendance([1]),
  }),
  working(40, "Vedant Rao", {
    attendance: sparseAttendance([6]),
  }),

  studying(41, "Krisha Agarwal", {
    active: false,
    attendance: sparseAttendance([]),
  }),
  working(42, "Madhav Rangan", {
    active: false,
    attendance: sparseAttendance([0]),
  }),
  studying(43, "Anaya Desai", {
    active: false,
    attendance: sparseAttendance([3]),
  }),
  working(44, "Dhruv Khanna", {
    active: false,
    attendance: sparseAttendance([]),
  }),
  studying(45, "Lavanya Prasad", {
    active: false,
    attendance: sparseAttendance([7]),
  }),

  studying(46, "Eshan Narang", {
    attendance: absentAt(2, 6),
    trips: ["mayTrip"],
  }),
  working(47, "Zoya Sheikh", {
    attendance: absentAt(1, 5),
    volunteering: ["mayService"],
  }),
  studying(48, "Parth Tiwari", {
    attendance: absentAt(0, 4),
    trips: ["aprilTrip"],
    volunteering: ["aprilService"],
  }),
  working(49, "Janvi Shah", {
    attendance: allPresent(),
  }),
  studying(50, "Neil Mathew", {
    active: false,
    attendance: allPresent(),
  }),
]

const parseDate = (value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const assertSunday = (dateValue) => {
  const date = parseDate(dateValue)
  if (!date || date.getUTCDay() !== 0) {
    throw new Error(`${dateValue} must be a Sunday`)
  }
}

const countBy = (items, predicate) =>
  items.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0)

const main = async () => {
  const client = await pool.connect()

  try {
    for (const date of [...YFH_SESSION_DATES, ...GITA_SESSION_DATES]) {
      assertSunday(date)
    }

    await client.query("BEGIN")

    await client.query(
      `TRUNCATE TABLE
         gita_attendance,
         gita_sessions,
         gita_students,
         attendance,
         trip_participants,
         volunteering_participants,
         class_sessions,
         trips,
         volunteering_services,
         students,
         classes
       RESTART IDENTITY CASCADE`
    )

    const adminResult = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
    )
    const adminId = adminResult.rows[0]?.id ?? null

    if (!adminId) {
      throw new Error("No admin user found. Create an admin first.")
    }

    const classIds = new Map()
    for (let i = 0; i < CLASS_ROTATION.length; i += 1) {
      const result = await client.query(
        `INSERT INTO classes (name, order_index)
         VALUES ($1, $2)
         RETURNING id`,
        [CLASS_ROTATION[i], i + 1]
      )
      classIds.set(CLASS_ROTATION[i], result.rows[0].id)
    }

    const yfhSessions = []
    for (let i = 0; i < YFH_SESSION_DATES.length; i += 1) {
      const className = CLASS_ROTATION[i]
      const result = await client.query(
        `INSERT INTO class_sessions (class_date, day_of_week, class_id, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [YFH_SESSION_DATES[i], "Sunday", classIds.get(className), adminId]
      )
      yfhSessions.push({
        id: result.rows[0].id,
        date: YFH_SESSION_DATES[i],
        className,
      })
    }

    const gitaSessions = []
    for (const sessionDate of GITA_SESSION_DATES) {
      const result = await client.query(
        `INSERT INTO gita_sessions (session_date, day_of_week, created_by)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [sessionDate, "Sunday", adminId]
      )
      gitaSessions.push({ id: result.rows[0].id, date: sessionDate })
    }

    const tripIds = new Map()
    for (const trip of TRIPS) {
      const result = await client.query(
        `INSERT INTO trips (trip_date, details, created_by)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [trip.date, trip.details, adminId]
      )
      tripIds.set(trip.key, result.rows[0].id)
    }

    const volunteeringIds = new Map()
    for (const service of VOLUNTEERING_SERVICES) {
      const result = await client.query(
        `INSERT INTO volunteering_services (service_date, details, created_by)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [service.date, service.details, adminId]
      )
      volunteeringIds.set(service.key, result.rows[0].id)
    }

    const insertedStudents = []

    for (const student of STUDENT_SEEDS) {
      const result = await client.query(
        `INSERT INTO students (
           full_name,
           email,
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
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
          student.full_name,
          student.email,
          student.phone,
          student.age,
          student.student_type,
          student.student_type === "studying" ? student.college_name : null,
          student.student_type === "studying" ? student.branch : null,
          student.student_type === "studying" ? student.semester : null,
          student.student_type === "working" ? student.company_name : null,
          student.student_type === "working" ? student.designation : null,
          student.student_type === "working" ? student.experience : null,
          student.active,
          student.level,
          student.promoted_at,
        ]
      )

      insertedStudents.push({ ...student, id: result.rows[0].id })
    }

    for (const [sessionIndex, session] of yfhSessions.entries()) {
      for (const student of insertedStudents) {
        const status = student.attendance[sessionIndex] ?? "absent"
        await client.query(
          `INSERT INTO attendance (session_id, student_id, status, marked_by, marked_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [session.id, student.id, status, adminId, `${session.date}T09:00:00Z`]
        )
      }
    }

    for (const student of insertedStudents) {
      for (const tripKey of student.trips) {
        const tripId = tripIds.get(tripKey)
        const trip = TRIPS.find((item) => item.key === tripKey)
        await client.query(
          `INSERT INTO trip_participants (trip_id, student_id, added_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (trip_id, student_id) DO NOTHING`,
          [tripId, student.id, `${trip.date}T10:00:00Z`]
        )
      }

      for (const serviceKey of student.volunteering) {
        const serviceId = volunteeringIds.get(serviceKey)
        const service = VOLUNTEERING_SERVICES.find((item) => item.key === serviceKey)
        await client.query(
          `INSERT INTO volunteering_participants (service_id, student_id, added_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (service_id, student_id) DO NOTHING`,
          [serviceId, student.id, `${service.date}T10:00:00Z`]
        )
      }

      if (student.level >= 2) {
        await client.query(
          `INSERT INTO gita_students (student_id)
           VALUES ($1)
           ON CONFLICT (student_id) DO NOTHING`,
          [student.id]
        )

        for (const [sessionIndex, session] of gitaSessions.entries()) {
          const status = student.gitaAttendance?.[sessionIndex] ?? "absent"
          await client.query(
            `INSERT INTO gita_attendance (session_id, student_id, status, marked_by, marked_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [session.id, student.id, status, adminId, `${session.date}T17:00:00Z`]
          )
        }
      }
    }

    await client.query("COMMIT")

    const promotedCount = countBy(STUDENT_SEEDS, (student) => student.level >= 2)
    const tripOnlyCount = countBy(
      STUDENT_SEEDS,
      (student) =>
        student.level === 1 &&
        student.attendance.every((status) => status === "present") &&
        student.trips.length > 0 &&
        student.volunteering.length === 0
    )
    const volunteerOnlyCount = countBy(
      STUDENT_SEEDS,
      (student) =>
        student.level === 1 &&
        student.attendance.every((status) => status === "present") &&
        student.trips.length === 0 &&
        student.volunteering.length > 0
    )
    const bothDoneMissingClassesCount = countBy(
      STUDENT_SEEDS,
      (student) =>
        student.level === 1 &&
        !student.attendance.every((status) => status === "present") &&
        student.trips.length > 0 &&
        student.volunteering.length > 0
    )

    console.log("Seeded aggressive test data successfully.")
    console.log(`Students: ${STUDENT_SEEDS.length}`)
    console.log(`Studying: ${countBy(STUDENT_SEEDS, (s) => s.student_type === "studying")}`)
    console.log(`Working: ${countBy(STUDENT_SEEDS, (s) => s.student_type === "working")}`)
    console.log(`Active level 1: ${countBy(STUDENT_SEEDS, (s) => s.level === 1 && s.active)}`)
    console.log(`Inactive level 1: ${countBy(STUDENT_SEEDS, (s) => s.level === 1 && !s.active)}`)
    console.log(`Promoted/Gita students: ${promotedCount}`)
    console.log(`Full classes + trip, volunteering pending: ${tripOnlyCount}`)
    console.log(`Full classes + volunteering, trip pending: ${volunteerOnlyCount}`)
    console.log(`Trip + volunteering done, classes missing: ${bothDoneMissingClassesCount}`)
    console.log(`YFH Sunday sessions: ${YFH_SESSION_DATES.join(", ")}`)
    console.log(`Bhagavad Gita Sunday sessions: ${GITA_SESSION_DATES.join(", ")}`)
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Failed to seed data:", error)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
