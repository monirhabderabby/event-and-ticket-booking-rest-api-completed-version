import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

// POST /api/payments/:bookingId/pay
// Body (optional): { "status": "completed" }  or  { "status": "failed" }
// There is no real payment gateway in class, so this endpoint pretends to be one.
export const payForBooking = async (req: AuthRequest, res: Response) => {
  try {
    const bookingId = req.params.bookingId as string;
    const status = req.body?.status || "completed";

    // 1. Simple validation
    if (status !== "completed" && status !== "failed") {
      return res.status(400).json({ success: false, message: "status must be completed or failed" });
    }

    // 2. Find the booking and check the owner
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.userId !== req.user!.id) {
      return res.status(403).json({ success: false, message: "This is not your booking" });
    }

    // 3. Find the payment and make sure it is still pending
    const payment = await prisma.payment.findUnique({ where: { bookingId } });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    if (payment.status !== "pending") {
      return res.status(400).json({ success: false, message: `Payment is already ${payment.status}` });
    }

    // 4. Update payment and booking together
    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({ where: { id: payment.id }, data: { status } });

      if (status === "completed") {
        // Paid: confirm the booking
        const updatedBooking = await tx.booking.update({ where: { id: bookingId }, data: { status: "confirmed" } });
        return { booking: updatedBooking, payment: updatedPayment };
      }

      // Failed: cancel the booking and give the seat back
      const updatedBooking = await tx.booking.update({ where: { id: bookingId }, data: { status: "cancelled" } });
      await tx.event.update({ where: { id: booking.eventId }, data: { seat: { increment: 1 } } });
      return { booking: updatedBooking, payment: updatedPayment };
    });

    return res.status(200).json({
      success: true,
      message: status === "completed" ? "Payment successful, booking confirmed" : "Payment failed, booking cancelled",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// GET /api/payments/my-payments
export const getMyPayments = async (req: AuthRequest, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user!.id },
      include: { event: { select: { id: true, name: true } }, coupon: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, message: "Payments fetched", data: payments });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// GET /api/payments  (admin: all payments)
export const getAllPayments = async (req: AuthRequest, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, event: true, coupon: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, message: "Payments fetched", data: payments });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
