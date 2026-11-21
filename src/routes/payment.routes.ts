import { Router } from "express";
import { payForBooking, getMyPayments, getAllPayments } from "../controllers/payment.controller.js";
import { verifyAuth, restrictTo } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/:bookingId/pay", verifyAuth, payForBooking);
router.get("/my-payments", verifyAuth, getMyPayments);
router.get("/", verifyAuth, restrictTo("admin"), getAllPayments);

export default router;
