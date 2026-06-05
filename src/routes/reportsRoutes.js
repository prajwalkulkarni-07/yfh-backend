import express from "express";
import {
	getAllStudentsReport,
	getEligibleReport,
	getInactiveReport,
	getReportByClass,
	getPromotedReport,
	getYetToAttendTripReport,
	getYetToVolunteerReport,
} from "../controllers/reportsController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/inactive", getInactiveReport);
router.get("/eligible", getEligibleReport);
router.get("/yet-to-attend-trip", getYetToAttendTripReport);
router.get("/yet-to-volunteer", getYetToVolunteerReport);
router.get("/by-class", getReportByClass);
router.get("/promoted", getPromotedReport);
router.get("/all-students", getAllStudentsReport);

export default router;
