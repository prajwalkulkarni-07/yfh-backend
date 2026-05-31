import express from "express";
import {
  listTrips,
  createTrip,
  updateTripParticipants,
  deleteTrip,
} from "../controllers/tripsController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/", listTrips);
router.post("/", createTrip);
router.put("/:id", updateTripParticipants);
router.delete("/:id", deleteTrip);

export default router;
