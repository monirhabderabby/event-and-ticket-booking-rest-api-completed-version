import { Router } from "express";
import { createGuest, getGuests, updateGuest, deleteGuest } from "../controllers/guest.controller.js";
import { verifyAuth, restrictTo } from "../middlewares/auth.middleware.js";

const router = Router();

// Public
router.get("/", getGuests);

// Admin only
router.post("/", verifyAuth, restrictTo("admin"), createGuest);
router.patch("/:id", verifyAuth, restrictTo("admin"), updateGuest);
router.delete("/:id", verifyAuth, restrictTo("admin"), deleteGuest);

export default router;
