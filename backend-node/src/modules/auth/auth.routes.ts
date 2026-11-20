import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { register, login, getMe } from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";

export const authRouter = Router();

authRouter.post("/auth/register", asyncHandler(register));
authRouter.post("/auth/login", asyncHandler(login));
authRouter.get("/auth/me", authenticate, asyncHandler(getMe));