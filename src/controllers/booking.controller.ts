import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

// POST /api/bookings
// Body: { "eventId": "...", "couponCode": "SAVE10" }  (couponCode is optional)
export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, couponCode } = req.body;
    const userId = req.user!.id;

    // 1. Simple validation
    if (!eventId) {
      return res.status(400).json({ success: false, message: "eventId is required" });
    }

    // 2. The event must exist and be published
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.status !== "published") {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // 3. The event must not be already started
    if (event.startTime && event.startTime < new Date()) {
      return res.status(400).json({ success: false, message: "This event has already started" });
    }

    // 4. Check seat availability
    if (event.seat === null || event.seat <= 0) {
      return res.status(400).json({ success: false, message: "No seat available" });
    }

    // 5. Apply coupon if provided (discount is a percentage)
    const originalPrice = event.price || 0;
    let finalPrice = originalPrice;
    let couponId: string | undefined = undefined;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon) {
        return res.status(404).json({ success: false, message: "Invalid coupon code" });
      }
      // A coupon tied to another event can not be used here
      if (coupon.eventId && coupon.eventId !== event.id) {
        return res.status(400).json({ success: false, message: "Coupon is not valid for this event" });
      }
      finalPrice = Math.round(originalPrice - (originalPrice * coupon.discount) / 100);
      couponId = coupon.id;
    }

    // 6. Do everything in one transaction (all steps succeed, or none)
    const result = await prisma.$transaction(async (tx) => {
      // 6a. Take one seat. The "seat > 0" check makes sure two people can not take the last seat.
      const seatTaken = await tx.event.updateMany({
        where: { id: event.id, seat: { gt: 0 } },
        data: { seat: { decrement: 1 } },
      });
      if (seatTaken.count === 0) {
        throw new Error("NO_SEAT");
      }

      // 6b. Create the booking (pending until paid)
      const booking = await tx.booking.create({
        data: { userId, eventId: event.id },
      });

      // 6c. Create the payment (pending until paid)
      const payment = await tx.payment.create({
        data: { userId, eventId: event.id, bookingId: booking.id, price: finalPrice, couponId },
      });

      // 6d. Save the paymentId on the booking
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { paymentId: payment.id },
      });

      return { booking: updatedBooking, payment };
    });

    return res.status(201).json({
      success: true,
      message: "Booking created. Please complete the payment.",
      data: result,
    });
  } catch (error: any) {
    if (error.message === "NO_SEAT") {
      return res.status(400).json({ success: false, message: "No seat available" });
    }
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// GET /api/bookings/my-bookings
export const getMyBookings = async (req: AuthRequest, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user!.id },
      include: { event: true, payment: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, message: "Bookings fetched", data: bookings });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// GET /api/bookings  (admin: all bookings)
export const getAllBookings = async (req: AuthRequest, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, event: true, payment: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, message: "Bookings fetched", data: bookings });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// PATCH /api/bookings/:id/cancel
export const cancelBooking = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    // 1. Find the booking
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // 2. Only the owner (or an admin) can cancel
    if (booking.userId !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ success: false, message: "This is not your booking" });
    }

    // 3. Already cancelled?
    if (booking.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }

    // 4. Cancel booking, give the seat back, and update the payment
    const result = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.booking.update({ where: { id }, data: { status: "cancelled" } });

      await tx.event.update({ where: { id: booking.eventId }, data: { seat: { increment: 1 } } });

      // Paid -> refunded, not paid yet -> failed
      const payment = await tx.payment.findUnique({ where: { bookingId: id } });
      if (payment && payment.status === "completed") {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "refunded" } });
      } else if (payment && payment.status === "pending") {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      }

      return cancelled;
    });

    return res.status(200).json({ success: true, message: "Booking cancelled", data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
