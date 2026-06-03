import express from "express";
import {
  createService,
  deleteService,
  listServices,
  updateServiceParticipants,
} from "../controllers/volunteeringController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/", listServices);
router.post("/", createService);
router.put("/:id", updateServiceParticipants);
router.delete("/:id", deleteService);

export default router;