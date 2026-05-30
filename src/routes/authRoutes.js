import express from "express";
import { login, getProfile, changePassword } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", login);
router.get("/profile", authenticate, getProfile);
router.post("/change-password", authenticate, changePassword);

export default router;
