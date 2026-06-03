import express from "express";
import {
  getGitaStudents,
  getGitaStudentById,
  getGitaStudentAttendance,
} from "../controllers/gitaStudentsController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/", getGitaStudents);
router.get("/:id", getGitaStudentById);
router.get("/:id/attendance", getGitaStudentAttendance);

export default router;
