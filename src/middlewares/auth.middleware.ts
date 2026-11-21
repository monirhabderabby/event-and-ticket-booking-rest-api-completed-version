import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import { prisma } from "../config/prisma.js";

// A Request that also carries the logged-in user
export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

// Step 1: check the Bearer token and attach the user to req.user
export const verifyAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Please login first" });
    }

    const token = header.split(" ")[1] as string;
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string; role: string };

    // Make sure the user still exists and is active
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (user.status !== "active") {
      return res.status(403).json({ success: false, message: `Account is ${user.status}` });
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// Step 2: allow only some roles, e.g. restrictTo("admin")
export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You are not allowed to do this" });
    }
    next();
  };
};
