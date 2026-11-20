
import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";

import { config } from "../../config.js";
import { prisma } from "../../db/prisma.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { Errors } from "../../errors/AppError.js";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw Errors.unauthorized();
  }

  const token = authorization.slice(7);

  let payload: jwt.JwtPayload;

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);

    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      throw Errors.unauthorized();
    }

    payload = decoded;
  } catch {
    throw Errors.unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throw Errors.unauthorized();
  }

  req.user = user;
  next();
});

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(Errors.unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(Errors.forbidden());
    }

    next();
  };
}
