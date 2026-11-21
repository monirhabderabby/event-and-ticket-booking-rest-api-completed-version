import { Router } from "express";
import { getMe, updateMe } from "../controllers/user.controller.js";
import { verifyAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/me", verifyAuth, getMe);
router.put("/me", verifyAuth, updateMe);

export default router;
