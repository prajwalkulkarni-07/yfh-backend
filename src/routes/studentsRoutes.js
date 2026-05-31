import express from "express";
import {
  createStudent,
  getStudents,
  getStudentById,
  getStudentDetails,
  updateStudent,
  setStudentStatus,
  deleteStudent,
} from "../controllers/studentsController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize("admin"));

router.post("/", createStudent);
router.get("/", getStudents);
router.get("/:id/details", getStudentDetails);
router.get("/:id", getStudentById);
router.put("/:id", updateStudent);
router.patch("/:id/status", setStudentStatus);
router.delete("/:id", deleteStudent);

export default router;
