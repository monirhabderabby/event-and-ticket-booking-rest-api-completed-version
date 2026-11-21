import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

// POST /api/guests  (admin)
export const createGuest = async (req: Request, res: Response) => {
  try {
    const { name, designation, company, shortDescription, eventId } = req.body;

    // 1. Simple validation
    if (!name || !designation || !company || !shortDescription || !eventId) {
      return res.status(400).json({
        success: false,
        message: "name, designation, company, shortDescription and eventId are required",
      });
    }

    // 2. The event must exist
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // 3. Create the guest
    const guest = await prisma.guest.create({
      data: { name, designation, company, shortDescription, eventId },
    });

    return res.status(201).json({ success: true, message: "Guest added", data: guest });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// GET /api/guests?eventId=...  (public)
export const getGuests = async (req: Request, res: Response) => {
  try {
    const eventId = req.query.eventId as string | undefined;

    // If eventId is sent, show only that event's guests
    const guests = await prisma.guest.findMany({
      where: eventId ? { eventId } : {},
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, message: "Guests fetched", data: guests });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Invalid eventId" });
  }
};

// PATCH /api/guests/:id  (admin)
export const updateGuest = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, designation, company, shortDescription } = req.body;

    // 1. Check the guest exists
    const guest = await prisma.guest.findUnique({ where: { id } });
    if (!guest) {
      return res.status(404).json({ success: false, message: "Guest not found" });
    }

    // 2. Update only the fields that were sent
    const updated = await prisma.guest.update({
      where: { id },
      data: { name, designation, company, shortDescription },
    });

    return res.status(200).json({ success: true, message: "Guest updated", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// DELETE /api/guests/:id  (admin)
export const deleteGuest = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const guest = await prisma.guest.findUnique({ where: { id } });
    if (!guest) {
      return res.status(404).json({ success: false, message: "Guest not found" });
    }

    await prisma.guest.delete({ where: { id } });
    return res.status(200).json({ success: true, message: "Guest deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
