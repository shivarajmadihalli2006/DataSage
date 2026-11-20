
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { prisma } from "../../db/prisma.js";
import { config } from "../../config.js";
import { AppError, Errors } from "../../errors/AppError.js";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function createToken(userId: string) {
  return jwt.sign(
    { sub: userId },
    config.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Please provide a valid name, email, and password.",
      { issues: parsed.error.issues }
    );
  }

  const name = parsed.data.name;
  const email = parsed.data.email.toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw Errors.emailAlreadyExists();
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "USER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const token = createToken(user.id);

  res.status(201).json({
    message: "Account created successfully.",
    token,
    user,
  });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Please provide a valid email and password.",
      { issues: parsed.error.issues }
    );
  }

  const email = parsed.data.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw Errors.invalidCredentials();
  }

  const passwordMatches = await bcrypt.compare(
    parsed.data.password,
    user.passwordHash
  );

  if (!passwordMatches) {
    throw Errors.invalidCredentials();
  }

  const token = createToken(user.id);

  res.status(200).json({
    message: "Login successful.",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}
export async function getMe(req: Request, res: Response) {
  if (!req.user) {
    throw Errors.unauthorized();
  }

  res.status(200).json({
    user: req.user,
  });
}