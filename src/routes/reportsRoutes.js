import express from "express";
import {
	getEligibleReport,
	getInactiveReport,
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
router.get("/promoted", getPromotedReport);

export default router;
