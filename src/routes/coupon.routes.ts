import { Router } from "express";
import { createCoupon, getCoupons, deleteCoupon } from "../controllers/coupon.controller.js";
import { verifyAuth, restrictTo } from "../middlewares/auth.middleware.js";

const router = Router();

// Admin only
router.post("/", verifyAuth, restrictTo("admin"), createCoupon);
router.get("/", verifyAuth, restrictTo("admin"), getCoupons);
router.delete("/:id", verifyAuth, restrictTo("admin"), deleteCoupon);

export default router;
