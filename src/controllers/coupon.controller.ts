import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

// POST /api/coupons  (admin)
// discount is a percentage (1 - 100). eventId is optional: without it the coupon works for every event.
export const createCoupon = async (req: Request, res: Response) => {
  try {
    const { code, discount, eventId } = req.body;

    // 1. Simple validation
    if (!code || discount === undefined) {
      return res.status(400).json({ success: false, message: "code and discount are required" });
    }
    if (discount < 1 || discount > 100) {
      return res.status(400).json({ success: false, message: "discount must be between 1 and 100" });
    }

    // 2. Code must be unique
    const exists = await prisma.coupon.findUnique({ where: { code } });
    if (exists) {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }

    // 3. If eventId is sent, the event must exist
    if (eventId) {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) {
        return res.status(404).json({ success: false, message: "Event not found" });
      }
    }

    // 4. Create the coupon
    const coupon = await prisma.coupon.create({ data: { code, discount, eventId } });
    return res.status(201).json({ success: true, message: "Coupon created", data: coupon });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// GET /api/coupons  (admin)
export const getCoupons = async (req: Request, res: Response) => {
  try {
    const coupons = await prisma.coupon.findMany();
    return res.status(200).json({ success: true, message: "Coupons fetched", data: coupons });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// DELETE /api/coupons/:id  (admin)
export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // 1. Check the coupon exists
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    // 2. A coupon that was already used in a payment can not be deleted
    const used = await prisma.payment.count({ where: { couponId: id } });
    if (used > 0) {
      return res.status(400).json({ success: false, message: "Coupon is already used, can not delete" });
    }

    await prisma.coupon.delete({ where: { id } });
    return res.status(200).json({ success: true, message: "Coupon deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
