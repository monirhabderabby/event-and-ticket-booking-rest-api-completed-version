import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import { prisma } from "../config/prisma.js";

// POST /api/auth/register
export const register = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, phone, designation } = req.body;

    // 1. Simple validation
    if (!firstName || !lastName || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: "firstName, lastName, email, password and phone are required",
      });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    // 2. Email and phone must be unique
    const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
    if (exists) {
      return res.status(409).json({ success: false, message: "Email or phone already registered" });
    }

    // 3. Hash the password, then save the user (role is always "user" here)
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { firstName, lastName, email, phone, designation, password: hashedPassword },
    });

    // 4. Never send the password back
    const { password: _hidden, ...safeUser } = user;
    return res.status(201).json({ success: true, message: "Registered successfully", data: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Simple validation
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password are required" });
    }

    // 2. Find the user and compare the password
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    if (user.status !== "active") {
      return res.status(403).json({ success: false, message: `Account is ${user.status}` });
    }

    // 3. Create a token that holds userId and role
    const token = jwt.sign({ userId: user.id, role: user.role }, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });

    const { password: _hidden, ...safeUser } = user;
    return res.status(200).json({ success: true, message: "Login successful", data: { token, user: safeUser } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
