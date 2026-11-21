import { Router } from "express";
import { createBooking, getMyBookings, getAllBookings, cancelBooking } from "../controllers/booking.controller.js";
import { verifyAuth, restrictTo } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", verifyAuth, createBooking);
router.get("/my-bookings", verifyAuth, getMyBookings);
router.get("/", verifyAuth, restrictTo("admin"), getAllBookings);
router.patch("/:id/cancel", verifyAuth, cancelBooking);

export default router;
