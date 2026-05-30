import express from "express";
import { getEligibleReport, getInactiveReport } from "../controllers/reportsController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/inactive", getInactiveReport);
router.get("/eligible", getEligibleReport);

export default router;
