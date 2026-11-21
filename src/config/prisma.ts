import { PrismaClient } from "../generated/prisma/client.js";

// One shared Prisma client for the whole app
export const prisma = new PrismaClient();
