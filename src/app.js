import express from "express";
import cors from "cors";
import pool from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import studentsRoutes from "./routes/studentsRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";
import tripsRoutes from "./routes/tripsRoutes.js";
import volunteeringRoutes from "./routes/volunteeringRoutes.js";
import gitaStudentsRoutes from "./routes/gitaStudentsRoutes.js";
import gitaAttendanceRoutes from "./routes/gitaAttendanceRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Yoga for Happiness Attendance API",
    status: "Running",
    version: "1.0.0",
  });
});

app.get("/test-db", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as now");
    res.json({
      success: true,
      message: "Database connected successfully",
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    console.error("DB connection error:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/trips", tripsRoutes);
app.use("/api/volunteering", volunteeringRoutes);
app.use("/api/gita/students", gitaStudentsRoutes);
app.use("/api/gita/attendance", gitaAttendanceRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, _req, res, _next) => {
  console.error("Global error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

export default app;
