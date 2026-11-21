import type { Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

// GET /api/users/me
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { password: _hidden, ...safeUser } = user;
    return res.status(200).json({ success: true, message: "Profile fetched", data: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// PUT /api/users/me
export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, phone, designation, password } = req.body;

    // 1. Only allow safe fields (role, email and status can not be changed here)
    const data: any = { firstName, lastName, phone, designation };

    // 2. If a new password is sent, hash it
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
      }
      data.password = await bcrypt.hash(password, 10);
    }

    // 3. Phone must stay unique
    if (phone) {
      const taken = await prisma.user.findFirst({ where: { phone, NOT: { id: req.user!.id } } });
      if (taken) {
        return res.status(409).json({ success: false, message: "Phone already in use" });
      }
    }

    const user = await prisma.user.update({ where: { id: req.user!.id }, data });

    const { password: _hidden, ...safeUser } = user;
    return res.status(200).json({ success: true, message: "Profile updated", data: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
