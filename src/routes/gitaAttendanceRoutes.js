import express from "express";
import {
  createSession,
  getSessions,
  markAttendance,
  getAttendance,
} from "../controllers/gitaAttendanceController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize("admin"));

router.post("/sessions", createSession);
router.get("/sessions", getSessions);
router.post("/mark", markAttendance);
router.get("/", getAttendance);

export default router;
