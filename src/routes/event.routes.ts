import { Router } from "express";
import { createEvent, getEvents, getEventById, updateEvent, deleteEvent } from "../controllers/event.controller.js";
import { verifyAuth, restrictTo } from "../middlewares/auth.middleware.js";

const router = Router();

// Public
router.get("/", getEvents);
router.get("/:id", getEventById);

// Admin only
router.post("/", verifyAuth, restrictTo("admin"), createEvent);
router.patch("/:id", verifyAuth, restrictTo("admin"), updateEvent);
router.delete("/:id", verifyAuth, restrictTo("admin"), deleteEvent);

export default router;
