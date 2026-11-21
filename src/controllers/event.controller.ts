import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

// POST /api/events  (admin)
export const createEvent = async (req: Request, res: Response) => {
  try {
    const { name, shortDescription, description, startTime, endTime, location, price, seat, banner, status } = req.body;

    // 1. Simple validation
    if (!name || !shortDescription) {
      return res.status(400).json({ success: false, message: "name and shortDescription are required" });
    }
    if (price !== undefined && price < 0) {
      return res.status(400).json({ success: false, message: "price can not be negative" });
    }
    if (seat !== undefined && seat < 0) {
      return res.status(400).json({ success: false, message: "seat can not be negative" });
    }

    // 2. Create the event (status is "draft" unless sent)
    const event = await prisma.event.create({
      data: {
        name,
        shortDescription,
        description,
        location,
        price,
        seat,
        banner,
        status,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
      },
    });

    return res.status(201).json({ success: true, message: "Event created", data: event });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// GET /api/events  (public: only published events)
// Optional query: ?search=music&minPrice=0&maxPrice=500&page=1&limit=10
export const getEvents = async (req: Request, res: Response) => {
  try {
    const { search, minPrice, maxPrice } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    // 1. Build the filter step by step
    const where: any = { status: "published" };

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { location: { contains: String(search), mode: "insensitive" } },
      ];
    }
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    // 2. Get one page of events and the total count
    const events = await prisma.event.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { startTime: "asc" },
    });
    const total = await prisma.event.count({ where });

    return res.status(200).json({
      success: true,
      message: "Events fetched",
      data: events,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// GET /api/events/:id  (public, includes guests)
export const getEventById = async (req: Request, res: Response) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id as string },
      include: { guests: true },
    });

    if (!event || event.status !== "published") {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    return res.status(200).json({ success: true, message: "Event fetched", data: event });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Invalid event id" });
  }
};

// PATCH /api/events/:id  (admin)
export const updateEvent = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, shortDescription, description, startTime, endTime, location, price, seat, banner, status } = req.body;

    // 1. Check the event exists
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // 2. Simple validation
    if (price !== undefined && price < 0) {
      return res.status(400).json({ success: false, message: "price can not be negative" });
    }
    if (seat !== undefined && seat < 0) {
      return res.status(400).json({ success: false, message: "seat can not be negative" });
    }

    // 3. Update only the fields that were sent
    const updated = await prisma.event.update({
      where: { id },
      data: {
        name,
        shortDescription,
        description,
        location,
        price,
        seat,
        banner,
        status,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
      },
    });

    return res.status(200).json({ success: true, message: "Event updated", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// DELETE /api/events/:id  (admin)
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // 1. Check the event exists
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // 2. Do not delete if the event already has bookings
    const bookings = await prisma.booking.count({ where: { eventId: id } });
    if (bookings > 0) {
      return res.status(400).json({ success: false, message: "Event has bookings, set status to draft instead" });
    }

    // 3. Remove guests and coupons first, then the event
    await prisma.guest.deleteMany({ where: { eventId: id } });
    await prisma.coupon.deleteMany({ where: { eventId: id } });
    await prisma.event.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Event deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
